// CrazyGames build smoke: serves dist-crazygames/ below a nested path, runs the
// game once with a stubbed CrazyGames SDK v3 (ad path) and once with the SDK
// blocked (ad blocker), and measures the bundle against the portal limits.
// Run `npm run build:crazygames` first.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { chromium } from "playwright";

const root = resolve("dist-crazygames");
const mount = "/games/sudoku/";
const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
const MB = 1024 * 1024;

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push({ path: full.slice(root.length + 1).replaceAll("\\", "/"), bytes: (await stat(full)).size });
  }
  return files;
}

// Static bundle checks.
const html = await readFile(join(root, "index.html"), "utf8");
assert.ok(!html.includes("hub-bridge.js"), "hub bridge is not shipped to CrazyGames");
assert.ok(html.includes(`<script src="${SDK_URL}"></script>`), "SDK v3 script tag present");
assert.match(html, /body \{[^}]*\buser-select: none/, "user-select: none on body");
const files = await walk(root);
const texts = await Promise.all(files.filter(file => /\.(html|css|js)$/.test(file.path)).map(file => readFile(join(root, file.path), "utf8")));
for (const [index, text] of texts.entries()) {
  assert.doesNotMatch(text, /(?:src|href)=["']\/(?!\/)/, `absolute path in ${files[index].path}`);
}
const externalOrigins = [...new Set(texts.flatMap(text => [...text.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})\//gi)].map(match => match[1])))]
  .filter(host => !/^(www\.w3\.org|github\.com|phaser\.io|rolldown\.rs)$/.test(host))
  .sort();
assert.ok(!texts.some(text => /apps\.apple\.com|play\.google\.com/.test(text)), "no app-store links");

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = pathname.startsWith(mount) ? pathname.slice(mount.length) || "index.html" : "missing";
  const file = resolve(root, relative);
  if (!file.startsWith(root + "/") && !file.startsWith(root + "\\")) return response.writeHead(403).end();
  try {
    const bytes = await readFile(file);
    response.setHeader("content-type", ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html" })[extname(file)] ?? "application/octet-stream");
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "chrome" } : {}) });

// Records every SDK call; ads stay pending until the test fires a callback.
const STUB = `window.__cg = { calls: [], ads: [] };
const log = name => () => window.__cg.calls.push(name);
window.CrazyGames = { SDK: {
  environment: "crazygames",
  init: async () => { window.__cg.calls.push("init"); },
  game: { loadingStart: log("loadingStart"), loadingStop: log("loadingStop"), gameplayStart: () => { window.__cg.calls.push("gameplayStart"); window.__cg.gameplayAtMs ??= Math.round(performance.now()); window.__cg.initialBytes ??= [performance.getEntriesByType("navigation")[0], ...performance.getEntriesByType("resource")].filter(entry => entry.name.startsWith(location.origin)).reduce((sum, entry) => sum + entry.decodedBodySize, 0); }, gameplayStop: log("gameplayStop") },
  ad: { requestAd: (kind, callbacks) => { window.__cg.calls.push("requestAd:" + kind); window.__cg.ads.push(callbacks); } },
} };`;

const solve = async page => {
  for (let count = 0; count < 81 && !(await page.locator("#result-dialog").isVisible()); count++) await page.keyboard.press("h");
  assert.equal(await page.locator("#result-dialog").isVisible(), true, "puzzle completion works");
};
const adState = page => page.evaluate(() => ({ adBreak: document.documentElement.dataset.adBreak ?? null, inert: document.querySelector("#app").inert }));
const calls = page => page.evaluate(() => window.__cg.calls);
// A real mouse click at the button's position: proves pointer input is blocked or restored.
const clickReplay = async page => {
  const box = await page.locator('[data-action="replay"]').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
};

const report = { date: new Date().toISOString().slice(0, 10) };
await mkdir("tests/evidence", { recursive: true });
try {
  for (const sdk of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (url === SDK_URL) return sdk ? route.fulfill({ status: 200, contentType: "text/javascript", body: STUB }) : route.abort("blockedbyclient");
      if (!url.startsWith(origin)) return route.abort();
      await route.continue();
    });
    await page.goto(origin + mount);
    await page.locator("[data-cell]").first().waitFor();

    if (sdk) {
      await page.waitForFunction(() => window.__cg.calls.includes("gameplayStart"));
      assert.deepEqual((await calls(page)).slice(0, 4), ["init", "loadingStart", "loadingStop", "gameplayStart"], "gameplayStart fires once the board is playable, after loading");
      await page.keyboard.press("h"); // keyboard works without a preliminary click
      await solve(page);
      await page.waitForFunction(() => window.__cg.ads.length === 1);
      const afterSolve = await calls(page);
      assert.ok(afterSolve.indexOf("gameplayStop") > afterSolve.indexOf("gameplayStart"), "gameplayStop on puzzle end");
      assert.equal(afterSolve.at(-1), "requestAd:midgame");

      // Requested: paused and input blocked, not yet muted.
      assert.deepEqual(await adState(page), { adBreak: "paused", inert: true });
      await clickReplay(page);
      assert.equal(await page.locator("#result-dialog").isVisible(), true, "clicks are blocked during the ad");
      // adStarted: muted.
      await page.evaluate(() => window.__cg.ads[0].adStarted());
      assert.deepEqual(await adState(page), { adBreak: "muted", inert: true });
      // adFinished: resumed.
      await page.evaluate(() => window.__cg.ads[0].adFinished());
      assert.deepEqual(await adState(page), { adBreak: null, inert: false });
      await clickReplay(page);
      assert.equal(await page.locator("#result-dialog").isVisible(), false, "input restored after adFinished");
      assert.equal((await calls(page)).at(-1), "gameplayStart", "gameplay restarts on the next puzzle");

      // Second puzzle: the ad fails (e.g. Basic Launch or unfilled), game resumes.
      await solve(page);
      await page.waitForFunction(() => window.__cg.ads.length === 2);
      assert.deepEqual(await adState(page), { adBreak: "paused", inert: true });
      await page.evaluate(() => window.__cg.ads[1].adError({ code: "adsDisabledBasicLaunch", message: "Ads are disabled" }));
      assert.deepEqual(await adState(page), { adBreak: null, inert: false });
      await clickReplay(page);
      assert.equal(await page.locator("#result-dialog").isVisible(), false, "input restored after adError");
      await page.screenshot({ path: `tests/evidence/${report.date}-crazygames-sdk-stub.png` });
      report.sdkCalls = await calls(page);
      report.initialDownloadBytes = await page.evaluate(() => window.__cg.initialBytes);
      report.localTimeToGameplayMs = await page.evaluate(() => window.__cg.gameplayAtMs);
    } else {
      assert.equal(await page.evaluate(() => typeof window.CrazyGames), "undefined");
      await solve(page);
      await page.waitForTimeout(200);
      assert.deepEqual(await adState(page), { adBreak: null, inert: false }, "no ad break without the SDK");
      await clickReplay(page);
      assert.equal(await page.locator("#result-dialog").isVisible(), false, "playable with the SDK blocked");
      await page.screenshot({ path: `tests/evidence/${report.date}-crazygames-adblock.png` });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  Object.assign(report, {
    files: files.length,
    totalBytes,
    externalOrigins,
    largest: files.sort((a, b) => b.bytes - a.bytes).slice(0, 3),
    limits: { initialMB: 50, mobileHomepageMB: 20, totalMB: 250, files: 1500 },
  });
  assert.ok(report.initialDownloadBytes > 0 && report.initialDownloadBytes <= 20 * MB, "initial download within 20 MB");
  assert.ok(totalBytes <= 250 * MB && files.length <= 1500, "total size and file count within limits");
  await writeFile(`tests/evidence/${report.date}-crazygames-smoke.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log("CrazyGames stub ad path (request/start/finish/error), ad-blocker play and bundle limits passed.");
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
