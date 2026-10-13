import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";

const root = resolve("dist");
const mount = "/games/sudoku/play/";
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const relative = pathname.startsWith(mount) ? pathname.slice(mount.length) || "index.html" : "missing";
  const file = resolve(root, relative);
  if (!file.startsWith(root + "/") && !file.startsWith(root + "\\")) return response.writeHead(403).end();
  try {
    const bytes = await readFile(file);
    response.setHeader("content-type", ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html" })[extname(file)] ?? "application/octet-stream");
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "chrome" } : {}) });
await mkdir("tests/evidence", { recursive: true });
try {
  assert.match(await readFile("dist/index.html", "utf8"), /src="\/hub-bridge\.js"/);
  for (const sdk of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const request = route.request();
      if (request.url() === `${origin}/hub-bridge.js`) {
        return route.fulfill({ status: sdk ? 200 : 404, contentType: "text/javascript", body: sdk ? "window.hubCalls=[]; window.Hub=Object.fromEntries(['ready','score','gameOver','event'].map(name=>[name,(...args)=>window.hubCalls.push({name,args})]));" : "" });
      }
      if (new URL(request.url()).origin !== origin) return route.abort();
      await route.continue();
    });
    await page.goto(origin + mount);
    await page.locator("[data-cell]").first().waitFor();
    // Keyboard works immediately: no preliminary click in the game.
    await page.keyboard.press("h");
    await page.keyboard.press("h");
    await page.screenshot({ path: `tests/evidence/2026-10-14-hub-${sdk ? "sdk" : "standalone"}.png` });
    for (let count = 0; count < 81 && !(await page.locator("#result-dialog").isVisible()); count++) await page.keyboard.press("h");
    assert.equal(await page.locator("#result-dialog").isVisible(), true, "puzzle completion works");
    if (sdk) {
      const calls = await page.evaluate(() => window.hubCalls);
      assert.ok(calls.some(call => call.name === "ready"));
      assert.ok(calls.some(call => call.name === "score"));
      assert.ok(calls.some(call => call.name === "gameOver"));
      const event = calls.find(call => call.name === "event");
      assert.equal(event.args[0], "puzzle-completed");
      assert.deepEqual(Object.keys(event.args[1]).sort(), ["difficulty", "mode", "reward", "seconds", "variant"]);
    } else assert.equal(await page.evaluate(() => typeof window.Hub), "undefined");
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("Nested static boot, keyboard completion, exact hub event and standalone play passed.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
