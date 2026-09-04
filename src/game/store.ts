import type { PlayerProgress, ThemeId } from "./types";

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
    return saved ? { ...DEFAULT_PROGRESS, ...JSON.parse(saved) } : { ...DEFAULT_PROGRESS };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: PlayerProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
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
