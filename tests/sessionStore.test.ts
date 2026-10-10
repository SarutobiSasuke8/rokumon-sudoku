import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMPAIGN } from "../src/game/presets";
import { createSession, type Session } from "../src/game/session";
import { decodeActiveState, encodeActiveState, loadActiveState, saveActiveState, SESSION_STORAGE_KEY } from "../src/game/sessionStore";
import { DEFAULT_PROGRESS, loadProgress, saveProgress } from "../src/game/store";
import { calculateReward } from "../src/game/sudoku";
import type { GameMode, PlayerProgress, VariantId } from "../src/game/types";

let values: Map<string, string>;
const progress = (): PlayerProgress => ({ ...DEFAULT_PROGRESS, completedNodes: [] });
const campaign = () => createSession("mini", "wanderer", "campaign", `campaign:${CAMPAIGN[0].id}`, 0);
function edit(session: Session, index: number, entry: number, notes: number[] = []): void {
  session.history.push({ index, entry: session.entries[index], notes: [...session.notes[index]] });
  session.entries[index] = entry;
  session.notes[index] = new Set(notes);
  session.selected = index;
}
function activeFixture(): Session {
  const session = campaign();
  const blanks = session.entries.flatMap((entry, index) => entry === 0 ? [index] : []);
  edit(session, blanks[0], 0, [2, 4]);
  edit(session, blanks[0], session.generated.solution[blanks[0]]);
  edit(session, blanks[1], 0, [1, 3]);
  session.noteMode = true;
  session.elapsed = 87;
  session.mistakes = 2;
  session.hints = 1;
  return session;
}
function completedFixture(): Session {
  const session = activeFixture();
  session.entries.forEach((entry, index) => {
    if (entry === 0) edit(session, index, session.generated.solution[index]);
  });
  session.status = "complete";
  session.reward = calculateReward(session.rewardBase, session.elapsed, session.mistakes, session.hints);
  return session;
}

beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("active puzzle checkpoints", () => {
  it("restores entries, pencil marks, full undo history, selection, tools, timer and counters", () => {
    const session = activeFixture();
    expect(saveActiveState(session, progress())).toBe(true);
    const restored = loadActiveState(progress()).state!;
    expect(restored.session).toEqual(session);
    expect(restored.progress).toEqual(progress());
    const latest = restored.session.history.pop()!;
    restored.session.entries[latest.index] = latest.entry;
    restored.session.notes[latest.index] = new Set(latest.notes);
    const hint = restored.session.history.pop()!;
    restored.session.entries[hint.index] = hint.entry;
    restored.session.notes[hint.index] = new Set(hint.notes);
    expect(restored.session.entries[hint.index]).toBe(0);
    expect([...restored.session.notes[hint.index]]).toEqual([2, 4]);
  });

  it.each<VariantId>(["classic", "diagonal", "mini", "chromatic"])("regenerates the same %s puzzle from its identity", variant => {
    const session = createSession(variant, "adept", "quick", `quick:${variant}:adept:123`);
    const restored = decodeActiveState(encodeActiveState(session, progress()))!;
    expect(restored.session.generated).toEqual(session.generated);
  });

  it.each<GameMode>(["quick", "zen", "sprint", "daily"])("keeps %s mode without wall-clock catch-up", mode => {
    const session = mode === "daily"
      ? createSession("diagonal", "adept", mode, "daily:2026-09-01")
      : createSession("mini", "wanderer", mode, `${mode}:mini:wanderer:123`);
    session.elapsed = 90;
    const restored = decodeActiveState(encodeActiveState(session, progress()))!;
    expect(restored.session.mode).toBe(mode);
    expect(restored.session.elapsed).toBe(90);
    expect(restored.session.generated.seed).toBe(session.generated.seed);
  });

  it("restores a completed board and its progression when the legacy mirror write failed", () => {
    const completed = completedFixture();
    const earned = { ...progress(), points: completed.reward!, solved: 1, campaignUnlocked: 1, completedNodes: [CAMPAIGN[0].id] };
    vi.mocked(localStorage.setItem).mockImplementation((key, raw) => {
      if (key !== SESSION_STORAGE_KEY) throw new Error("quota");
      values.set(key, raw);
    });
    expect(saveActiveState(completed, earned)).toBe(true);
    saveProgress(earned);
    expect(loadProgress().solved).toBe(0);
    const restored = loadActiveState(loadProgress()).state!;
    expect(restored.session.status).toBe("complete");
    expect(restored.progress).toEqual(earned);
    expect(localStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed Sprint terminal with no reward", () => {
    const sprint = createSession("mini", "wanderer", "sprint", "sprint:mini:wanderer:123");
    sprint.elapsed = 300;
    sprint.status = "failed";
    expect(decodeActiveState(encodeActiveState(sprint, progress()))!.session).toEqual(sprint);
  });

  it.each(["{truncated", "null", "[]", '{"version":1}'])("recovers visibly from %s without changing legacy progression", raw => {
    const legacy = { ...progress(), points: 450, solved: 2 };
    saveProgress(legacy);
    values.set(SESSION_STORAGE_KEY, raw);
    expect(loadActiveState(legacy)).toEqual({ notice: expect.stringContaining("could not be restored") });
    expect(loadProgress()).toEqual(legacy);
  });

  it("rejects an oversized snapshot before parsing or regeneration", () => {
    expect(decodeActiveState(" ".repeat(1_000_001))).toBeUndefined();
  });

  it("keeps newer legacy progression instead of reviving an older playable checkpoint", () => {
    saveActiveState(activeFixture(), progress());
    const newer = { ...progress(), points: 500, solved: 1, campaignUnlocked: 1 };
    expect(loadActiveState(newer)).toEqual({ notice: expect.stringContaining("progress changed") });
  });

  it("handles blocked reads and quota writes while retaining the last good checkpoint", () => {
    const original = activeFixture();
    saveActiveState(original, progress());
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error("quota"); });
    original.elapsed += 1;
    expect(saveActiveState(original, progress())).toBe(false);
    expect(loadActiveState(progress()).state!.session.elapsed).toBe(87);
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error("blocked"); });
    expect(loadActiveState(progress())).toEqual({});
  });

  type Snapshot = ReturnType<typeof JSON.parse>;
  const corruptions: [string, (saved: Snapshot) => void][] = [
    ["schema version", saved => { saved.version = 2; }],
    ["prototype variant", saved => { saved.session.variant = "toString"; }],
    ["unknown difficulty", saved => { saved.session.difficulty = "impossible"; }],
    ["unknown mode", saved => { saved.session.mode = "endless"; }],
    ["missing seed", saved => { delete saved.session.seed; }],
    ["campaign identity", saved => { saved.session.seed = "campaign:g2-1"; }],
    ["locked campaign", saved => { saved.session.campaignIndex = 11; }],
    ["truncated clues", saved => { saved.session.clues.pop(); }],
    ["changed generator clues", saved => { saved.session.clues[0] = 6; }],
    ["changed given", saved => { const index = saved.session.clues.findIndex((entry: number) => entry !== 0); saved.session.entries[index] = 0; }],
    ["wrong entry", saved => { const index = saved.session.entries.findIndex((entry: number) => entry === 0); saved.session.entries[index] = 7; }],
    ["truncated notes", saved => { saved.session.notes.pop(); }],
    ["out of range note", saved => { saved.session.notes[saved.session.selected] = [7]; }],
    ["duplicate notes", saved => { saved.session.notes[saved.session.selected] = [1, 1]; }],
    ["hidden notes on a filled cell", saved => { const index = saved.session.entries.findIndex((entry: number) => entry !== 0); saved.session.notes[index] = [1]; }],
    ["selection", saved => { saved.session.selected = 36; }],
    ["note mode", saved => { saved.session.noteMode = "yes"; }],
    ["negative time", saved => { saved.session.elapsed = -1; }],
    ["unsafe mistake count", saved => { saved.session.mistakes = Number.MAX_SAFE_INTEGER + 1; }],
    ["fractional hint count", saved => { saved.session.hints = 1.5; }],
    ["history collection", saved => { saved.session.history = null; }],
    ["undo index", saved => { saved.session.history[0].index = 100; }],
    ["undo given", saved => { saved.session.history[0].index = saved.session.clues.findIndex((entry: number) => entry !== 0); }],
    ["undo entry", saved => { saved.session.history[0].entry = 7; }],
    ["undo notes", saved => { saved.session.history[0].notes = [0]; }],
    ["missing undo history", saved => { saved.session.history = []; }],
    ["unsolved completion", saved => { saved.session.status = "complete"; }],
    ["non-Sprint failure", saved => { saved.session.status = "failed"; }],
    ["checkpoint progression", saved => { saved.progress.points = "lots"; }],
  ];
  it.each(corruptions)("rejects corrupt %s", (_label, corrupt) => {
    const saved = JSON.parse(encodeActiveState(activeFixture(), progress()));
    corrupt(saved);
    expect(decodeActiveState(JSON.stringify(saved))).toBeUndefined();
  });

  it("rejects a solved board labelled playing or an altered completion reward", () => {
    const saved = JSON.parse(encodeActiveState(completedFixture(), progress()));
    saved.session.status = "playing";
    delete saved.session.reward;
    expect(decodeActiveState(JSON.stringify(saved))).toBeUndefined();
    saved.session.status = "complete";
    saved.session.reward = 9999;
    expect(decodeActiveState(JSON.stringify(saved))).toBeUndefined();
  });

  it("rejects a malformed Daily identity and an expired Sprint labelled playing", () => {
    const daily = createSession("diagonal", "adept", "daily", "daily:2026-02-31");
    expect(decodeActiveState(encodeActiveState(daily, progress()))).toBeUndefined();
    const sprint = createSession("mini", "wanderer", "sprint", "sprint:mini:wanderer:123");
    sprint.elapsed = 300;
    expect(decodeActiveState(encodeActiveState(sprint, progress()))).toBeUndefined();
  });
});
