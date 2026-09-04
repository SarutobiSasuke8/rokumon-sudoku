export type VariantId = "classic" | "diagonal" | "mini" | "chromatic";
export type Difficulty = "wanderer" | "adept" | "master" | "legend";
export type GameMode = "campaign" | "quick" | "daily" | "zen" | "sprint";
export type ThemeId = "parchment" | "midnight" | "sakura" | "moss";

export interface VariantDefinition {
  id: VariantId;
  name: string;
  description: string;
  size: number;
  boxRows: number;
  boxCols: number;
  diagonal?: boolean;
  chromatic?: boolean;
}

export interface GeneratedPuzzle {
  puzzle: number[];
  solution: number[];
  seed: string;
  variant: VariantDefinition;
  difficulty: Difficulty;
}

export interface PlayerProgress {
  points: number;
  campaignUnlocked: number;
  completedNodes: string[];
  solved: number;
  bestStreak: number;
  streak: number;
  lastPlayedDate?: string;
  theme: ThemeId;
}
