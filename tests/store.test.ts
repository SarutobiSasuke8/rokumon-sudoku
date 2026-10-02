import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMPAIGN } from "../src/game/presets";
import { DEFAULT_PROGRESS, loadProgress, saveProgress } from "../src/game/store";

const key = "rokumon-sudoku-progress-v1";
let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((name: string) => values.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => values.set(name, value)),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("player progress storage", () => {
  it("preserves valid progress across a save and reload", () => {
    const progress = {
      ...DEFAULT_PROGRESS,
      points: 1800,
      campaignUnlocked: 3,
      completedNodes: [CAMPAIGN[0].id],
      solved: 4,
      streak: 2,
      bestStreak: 5,
      lastPlayedDate: "2026-10-01",
      theme: "midnight" as const,
    };
    saveProgress(progress);
    expect(loadProgress()).toEqual(progress);
  });

  it.each(["{not json", "null", "true", '"bad"', "[]"])("recovers from invalid save %s", (raw) => {
    values.set(key, raw);
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it("keeps valid fields while recovering invalid counters, nodes, theme and date", () => {
    values.set(key, JSON.stringify({
      points: "many",
      campaignUnlocked: 999,
      completedNodes: [CAMPAIGN[0].id, CAMPAIGN[0].id, "unknown", 4],
      solved: 3,
      streak: -2,
      bestStreak: 1.5,
      theme: "unknown",
      lastPlayedDate: "2026-02-31",
    }));
    expect(loadProgress()).toEqual({
      ...DEFAULT_PROGRESS,
      campaignUnlocked: CAMPAIGN.length - 1,
      completedNodes: [CAMPAIGN[0].id],
      solved: 3,
    });
  });

  it("does not accept a broken completed-node collection", () => {
    values.set(key, JSON.stringify({ completedNodes: null, campaignUnlocked: -1, points: Number.MAX_SAFE_INTEGER + 1 }));
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it("gives each fresh load its own completed-node collection", () => {
    const first = loadProgress();
    first.completedNodes.push(CAMPAIGN[0].id);
    expect(loadProgress().completedNodes).toEqual([]);
    expect(DEFAULT_PROGRESS.completedNodes).toEqual([]);
  });

  it("continues when storage cannot be read or written", () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error("blocked"); });
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error("full"); });
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
    expect(() => saveProgress({ ...DEFAULT_PROGRESS, completedNodes: [] })).not.toThrow();
  });
});
