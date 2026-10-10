import { CAMPAIGN, VARIANTS } from "./presets";
import { createPuzzle } from "./sudoku";
import type { Difficulty, GameMode, GeneratedPuzzle, VariantId } from "./types";

export interface Move {
  index: number;
  entry: number;
  notes: number[];
}

export interface Session {
  generated: GeneratedPuzzle;
  entries: number[];
  notes: Set<number>[];
  selected: number;
  noteMode: boolean;
  mistakes: number;
  hints: number;
  history: Move[];
  elapsed: number;
  mode: GameMode;
  campaignIndex?: number;
  rewardBase: number;
  status: "playing" | "complete" | "failed";
  errorIndex?: number;
  reward?: number;
}

export function createSession(variant: VariantId, difficulty: Difficulty, mode: GameMode, seed: string, campaignIndex?: number): Session {
  const generated = createPuzzle(VARIANTS[variant], difficulty, seed);
  return {
    generated,
    entries: [...generated.puzzle],
    notes: Array.from({ length: generated.puzzle.length }, () => new Set<number>()),
    selected: generated.puzzle.findIndex(value => value === 0),
    noteMode: false,
    mistakes: 0,
    hints: 0,
    history: [],
    elapsed: 0,
    mode,
    campaignIndex,
    rewardBase: campaignIndex === undefined ? 300 : CAMPAIGN[campaignIndex].reward,
    status: "playing",
  };
}
