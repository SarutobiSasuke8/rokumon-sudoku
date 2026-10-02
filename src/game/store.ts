import type { PlayerProgress, ThemeId } from "./types";
import { CAMPAIGN } from "./presets";

const STORAGE_KEY = "rokumon-sudoku-progress-v1";

export const DEFAULT_PROGRESS: PlayerProgress = {
  points: 0,
  campaignUnlocked: 0,
  completedNodes: [],
  solved: 0,
  bestStreak: 0,
  streak: 0,
  theme: "parchment",
};

export function loadProgress(): PlayerProgress {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return freshProgress();
    const value = parsed as Record<string, unknown>;
    const counter = (key: keyof PlayerProgress): number => {
      const candidate = value[key];
      return typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0;
    };
    const themes: ThemeId[] = ["parchment", "midnight", "sakura", "moss"];
    const nodeIds = new Set(CAMPAIGN.map((node) => node.id));
    const lastPlayedDate = value.lastPlayedDate;
    const validDate = typeof lastPlayedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(lastPlayedDate)
      && Number.isFinite(Date.parse(lastPlayedDate)) && new Date(lastPlayedDate).toISOString().slice(0, 10) === lastPlayedDate;
    return {
      points: counter("points"),
      campaignUnlocked: Math.min(CAMPAIGN.length - 1, counter("campaignUnlocked")),
      completedNodes: Array.isArray(value.completedNodes)
        ? [...new Set(value.completedNodes.filter((node): node is string => typeof node === "string" && nodeIds.has(node)))] : [],
      solved: counter("solved"),
      bestStreak: counter("bestStreak"),
      streak: counter("streak"),
      theme: themes.includes(value.theme as ThemeId) ? value.theme as ThemeId : DEFAULT_PROGRESS.theme,
      ...(validDate ? { lastPlayedDate } : {}),
    };
  } catch {
    return freshProgress();
  }
}

function freshProgress(): PlayerProgress {
  return { ...DEFAULT_PROGRESS, completedNodes: [] };
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Progress stays usable in memory when browser storage is blocked or full.
  }
}

export function setTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "midnight" ? "#151a25" : "#f1e7d0");
}

export function rankFor(points: number): { title: string; level: number; next: number } {
  const ranks = [
    { title: "Initiate", threshold: 0 },
    { title: "Wayfinder", threshold: 800 },
    { title: "Adept", threshold: 2200 },
    { title: "Cipher Sage", threshold: 5000 },
    { title: "Keeper of Nine", threshold: 9000 },
  ];
  const current = [...ranks].reverse().find((rank) => points >= rank.threshold) ?? ranks[0];
  const index = ranks.indexOf(current);
  return { title: current.title, level: index + 1, next: ranks[index + 1]?.threshold ?? current.threshold };
}
