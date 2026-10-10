import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceArgument = process.argv.find(argument => argument === "--evidence" || argument.startsWith("--evidence="));
const evidence = evidenceArgument ? path.join(root, "tests/evidence") : null;
const stamp = evidenceArgument?.split("=")[1] ?? new Date().toISOString().slice(0, 10);
assert.match(stamp, /^\d{4}-\d{2}-\d{2}$/);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check, label) => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { const result = await check(); if (result) return result; } catch {}
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
};
const portProbe = createServer();
await new Promise(resolve => portProbe.listen(0, "127.0.0.1", resolve));
const appPort = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const appUrl = `http://127.0.0.1:${appPort}`;
const profile = await mkdtemp(path.join(tmpdir(), "sudoku-session-smoke-"));
const server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(appPort), "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
server.stdout.on("data", chunk => process.stdout.write(chunk));
server.stderr.on("data", chunk => process.stderr.write(chunk));
let browser, socket;
const errors = [];
const checks = [];
try {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await rm(path.join(evidence, `${stamp}-resume-smoke.json`), { force: true });
  }
  await waitFor(async () => (await fetch(appUrl)).ok, "Vite");
  const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
  browser = spawn(chrome, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--window-size=1440,900", appUrl], { stdio: "ignore", windowsHide: true });
  browser.on("error", error => errors.push(error.message));
  const portText = await waitFor(async () => { try { return await readFile(path.join(profile, "DevToolsActivePort"), "utf8"); } catch { return null; } }, "Chrome debug port (set CHROME_PATH if needed)");
  const debugPort = portText.split(/\r?\n/)[0];
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(entry => entry.type === "page" && entry.url.startsWith(appUrl)), "page");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0, loadComplete;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Page.loadEventFired") loadComplete?.();
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(" "));
    if (pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const data = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (data.exceptionDetails) throw new Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text);
    return data.result.value;
  };
  const reload = async () => {
    let timeout;
    const loaded = new Promise((resolve, reject) => { loadComplete = resolve; timeout = setTimeout(() => reject(new Error("Timed out loading page")), 60000); });
    await call("Page.reload", { ignoreCache: true });
    try { await loaded; } finally { clearTimeout(timeout); loadComplete = null; }
    await waitFor(() => evaluate("document.querySelectorAll('[data-cell]').length > 0"), "board");
  };
  const capture = async name => {
    if (!evidence) return;
    const shot = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(path.join(evidence, `${stamp}-resume-${name}.png`), Buffer.from(shot.data, "base64"));
  };
  const resize = async (width, height, mobile = false) => {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
    await delay(300);
  };
  const key = async (key, code, modifiers = 0) => {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, text: key.length === 1 && !modifiers ? key : undefined });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers });
  };
  await call("Page.enable");
  await call("Runtime.enable");
  await resize(1440, 900);
  await waitFor(() => evaluate("document.querySelectorAll('[data-cell]').length > 0"), "initial board");
  await key("h", "KeyH");
  const entered = await evaluate("[...document.querySelectorAll('[data-cell]')].map(cell => Number(cell.dataset.value))");
  await reload();
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-cell]')].map(cell => Number(cell.dataset.value))"), entered, "refresh must retain the active entries");
  checks.push("Refresh retains an actual player hint");

  const activeKey = "rokumon-sudoku-active-v1";
  const legacyKey = "rokumon-sudoku-progress-v1";
  const reloadWithCheckpoint = async raw => {
    // Inject at the next boot, after the old document's final page-hide save.
    const script = await call("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem('${activeKey}', ${JSON.stringify(raw)})` });
    try { await reload(); } finally { await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier }); }
  };
  const checkpoint = () => evaluate(`JSON.parse(localStorage.getItem('${activeKey}'))`);
  const uiState = () => evaluate(`({
    entries: [...document.querySelectorAll('[data-cell]')].map(cell => Number(cell.dataset.value)),
    notes: [...document.querySelectorAll('[data-cell]')].map(cell => [...cell.querySelectorAll('.notes i')].map(note => note.textContent).filter(Boolean)),
    selected: Number(document.querySelector('[data-cell].is-selected')?.dataset.cell),
    noteMode: document.querySelector('[data-action="notes"]').getAttribute('aria-pressed'),
    mistakes: document.querySelector('.run-stats div:last-child dd').textContent,
    timer: document.querySelector('[data-timer]').textContent,
    title: document.querySelector('#puzzle-title').textContent
  })`);
  const assertRestored = async (before, label) => {
    const { timer: beforeTime, ...beforeBoard } = before;
    const { timer: afterTime, ...afterBoard } = await uiState();
    assert.deepEqual(afterBoard, beforeBoard, label);
    const seconds = time => time.split(":").reduce((minutes, part) => minutes * 60 + Number(part), 0);
    const delta = seconds(afterTime) - seconds(beforeTime);
    assert.ok(delta >= 0 && delta <= 2, "page-hide saves retain elapsed seconds, including active time between the assertion and refresh");
  };
  const clearAtBoot = await call("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.clear()" });
  try { await reload(); } finally { await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: clearAtBoot.identifier }); }
  await key("n", "KeyN");
  await key("2", "Digit2");
  await key("4", "Digit4");
  await key("n", "KeyN");
  await key("h", "KeyH");
  const hinted = await checkpoint();
  await key("n", "KeyN");
  await key("5", "Digit5");
  assert.deepEqual((await checkpoint()).session.notes[hinted.session.selected], [], "note mode does not add hidden pencil marks to a filled cell");
  assert.equal((await checkpoint()).session.history.length, hinted.session.history.length);
  await key("n", "KeyN");
  await evaluate("document.querySelector('[data-cell][data-value=" + JSON.stringify("0") + "]').click()");
  const wrong = await evaluate(`import('/src/game/sessionStore.ts').then(module => {
    const state = module.decodeActiveState(localStorage.getItem('${activeKey}'));
    return state.session.generated.solution[state.session.selected] === 1 ? 2 : 1;
  })`);
  await key(String(wrong), `Digit${wrong}`);
  await delay(600);
  await key("n", "KeyN");
  await key("1", "Digit1");
  await delay(1100);
  const beforePause = await uiState();
  await evaluate("document.querySelector('[data-action=" + JSON.stringify("new") + "]').click()");
  await delay(1200);
  assert.equal((await uiState()).timer, beforePause.timer, "open menus pause active play time");
  await capture("paused-menu");
  await key("h", "KeyH");
  assert.equal(await evaluate("document.querySelector('#new-dialog').open"), true);
  await evaluate("document.querySelector('#new-dialog').close()");
  const beforeResume = await uiState();
  await capture("desktop-before-refresh");
  await reload();
  await assertRestored(beforeResume, "the whole visible playing state survives refresh");
  const resumed = await checkpoint();
  assert.equal(resumed.session.hints, 1);
  assert.equal(resumed.session.mistakes, 1);
  assert.equal(resumed.session.history.length, 4);
  await capture("desktop-after-refresh");
  await key("z", "KeyZ", 2);
  const withoutLastNote = await checkpoint();
  assert.deepEqual(withoutLastNote.session.notes[resumed.session.selected], []);
  await key("z", "KeyZ", 2);
  const withoutHint = await checkpoint();
  const firstEditable = withoutHint.session.clues.findIndex(entry => entry === 0);
  assert.equal(withoutHint.session.entries[firstEditable], 0);
  assert.deepEqual(withoutHint.session.notes[firstEditable], [2, 4], "undo after refresh restores pencil marks replaced by a hint");
  checks.push("Refresh preserves notes, undo stack, selection, note mode, elapsed time, mistakes and hint count", "Restored undo removes the latest note and then restores the hinted cell's pencil marks", "Open dialogs pause the timer and retain keyboard focus", "Note mode on a filled cell does not add hidden notes or undo records");

  await resize(375, 812, true);
  assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth"), false);
  await evaluate("document.querySelector('[data-action=" + JSON.stringify("notes") + "]').click(); document.querySelector('[data-number=" + JSON.stringify("3") + "]').click()");
  const mobileState = await uiState();
  await reload();
  await assertRestored(mobileState, "mobile playing state survives refresh");
  await capture("mobile-after-refresh");
  checks.push("375x812 emulated touch layout fits and button-entered progress survives refresh");
  await resize(1440, 900);

  // Complete through the real Hint control. Make only the legacy mirror fail:
  // the atomic active checkpoint must still restore the board AND the award.
  const beforeComplete = (await checkpoint()).progress;
  await evaluate(`const originalWrite = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) {
    if (key === '${legacyKey}') throw new DOMException('Storage is full', 'QuotaExceededError');
    return originalWrite.call(this, key, value);
  };`);
  const blanks = await evaluate("document.querySelectorAll('[data-cell][data-value=" + JSON.stringify("0") + "]').length");
  for (let index = 0; index < blanks; index += 1) await key("h", "KeyH");
  await waitFor(() => evaluate("Boolean(document.querySelector('#result-dialog[open]'))"), "completion");
  const complete = await checkpoint();
  assert.equal(complete.session.status, "complete");
  assert.equal(complete.progress.solved, beforeComplete.solved + 1);
  assert.equal(complete.progress.points, beforeComplete.points + complete.session.reward);
  assert.equal(complete.progress.campaignUnlocked, 1);
  await delay(300);
  await capture("completed");
  await reload();
  await waitFor(() => evaluate("Boolean(document.querySelector('#result-dialog[open]'))"), "restored completion");
  assert.deepEqual((await checkpoint()).progress, complete.progress);
  await evaluate("document.querySelector('#result-dialog').close(); document.querySelector('[data-action=" + JSON.stringify("undo") + "]').click(); document.querySelector('[data-action=" + JSON.stringify("hint") + "]').click()");
  assert.equal((await checkpoint()).session.history.length, complete.session.history.length);
  await reload();
  assert.deepEqual((await checkpoint()).progress, complete.progress, "completed reload and controls do not award again");
  checks.push("Actual completion restores board, points, solved count and campaign unlock even if the legacy mirror write fails", "Repeated completed reload, Hint and Undo do not change rewards or terminal undo history");

  // Corrupt and truncated records recover visibly, preserving the old format.
  await evaluate(`localStorage.setItem('${legacyKey}', JSON.stringify(${JSON.stringify(complete.progress)}))`);
  await reloadWithCheckpoint('{truncated');
  assert.match(await evaluate("document.querySelector('[role=status]').textContent"), /could not be restored/);
  assert.deepEqual((await checkpoint()).progress, complete.progress);
  await capture("corrupt-recovery");
  const truncatedClues = await evaluate(`(() => { const saved = JSON.parse(localStorage.getItem('${activeKey}')); saved.session.clues.pop(); return JSON.stringify(saved); })()`);
  await reloadWithCheckpoint(truncatedClues);
  assert.match(await evaluate("document.querySelector('[role=status]').textContent"), /could not be restored/);
  assert.deepEqual((await checkpoint()).progress, complete.progress);
  checks.push("Truncated JSON and truncated clue arrays recover visibly without losing legacy progression");

  // Retain an old Daily's identity, rather than replacing its entries at midnight.
  const oldDaily = await evaluate(`Promise.all([import('/src/game/session.ts'), import('/src/game/sessionStore.ts')]).then(([sessions, store]) => {
    const saved = JSON.parse(localStorage.getItem('${activeKey}'));
    return store.encodeActiveState(sessions.createSession('diagonal', 'adept', 'daily', 'daily:2026-09-01'), saved.progress);
  })`);
  await reloadWithCheckpoint(oldDaily);
  assert.equal((await checkpoint()).session.seed, "daily:2026-09-01");
  assert.match((await uiState()).title, /2026-09-01/);
  await resize(375, 812, true);
  assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth"), false, "the dated Daily title fits the mobile layout");
  await capture("dated-daily-mobile");
  await resize(1440, 900);
  await evaluate("document.querySelector('[data-action=" + JSON.stringify("daily") + "]').click()");
  assert.equal((await checkpoint()).session.seed, `daily:${new Date().toISOString().slice(0, 10)}`);
  checks.push("An older Daily resumes its dated seed; choosing Daily starts today's UTC trial");

  // Sprint's remaining active seconds persist; no timestamps are used to catch up.
  const nearTimeout = await evaluate(`Promise.all([import('/src/game/session.ts'), import('/src/game/sessionStore.ts')]).then(([sessions, store]) => {
    const saved = JSON.parse(localStorage.getItem('${activeKey}'));
    const sprint = sessions.createSession('mini', 'wanderer', 'sprint', 'sprint:mini:wanderer:123');
    sprint.elapsed = 298; return store.encodeActiveState(sprint, saved.progress);
  })`);
  await reloadWithCheckpoint(nearTimeout);
  assert.equal((await uiState()).timer, "00:02");
  await waitFor(() => evaluate("Boolean(document.querySelector('#result-dialog[open]'))"), "Sprint timeout");
  const failed = await checkpoint();
  assert.equal(failed.session.status, "failed");
  assert.equal(failed.session.elapsed, 300);
  assert.deepEqual(failed.progress, complete.progress);
  await reload();
  assert.equal((await checkpoint()).session.status, "failed");
  assert.deepEqual((await checkpoint()).progress, failed.progress);
  await waitFor(() => evaluate("Boolean(document.querySelector('#result-dialog[open]'))"), "restored Sprint result");
  await delay(600);
  await capture("failed-sprint");
  checks.push("A Sprint resumes its remaining active seconds and stays failed after timeout and refresh");

  await evaluate("document.querySelector('#result-dialog').close(); document.querySelector('[data-campaign=" + JSON.stringify("0") + "]').click(); Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'))");
  const hiddenTime = (await uiState()).timer;
  await delay(1200);
  assert.equal((await uiState()).timer, hiddenTime, "hidden documents pause the timer");
  await evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))");
  await evaluate("Storage.prototype.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); }");
  await key("h", "KeyH");
  assert.match(await evaluate("document.querySelector('[role=status]').textContent"), /could not save/);
  const blockedBlanks = await evaluate("document.querySelectorAll('[data-cell][data-value=" + JSON.stringify("0") + "]').length");
  for (let index = 0; index < blockedBlanks; index += 1) await key("h", "KeyH");
  await waitFor(() => evaluate("Boolean(document.querySelector('#result-dialog[open]'))"), "completion with blocked writes");
  await delay(600);
  await capture("blocked-storage");
  assert.deepEqual((await checkpoint()).progress, failed.progress, "failed active write keeps the persisted progression behind the checkpoint");
  await reload();
  assert.deepEqual((await checkpoint()).progress, failed.progress);
  checks.push("Visibility-hidden lifecycle branch pauses active play time", "Quota-blocked saves show a clear notice while allowing completion; failed checkpoints do not advance persisted awards");
  assert.deepEqual(errors, [], "no browser console errors");
  const result = { date: stamp, checks, errors };
  if (evidence) await writeFile(path.join(evidence, `${stamp}-resume-smoke.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  socket?.close();
  browser?.kill();
  server.kill();
  await delay(400);
  assert.ok(path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
