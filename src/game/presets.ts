import type { Difficulty, GameMode, VariantDefinition, VariantId } from "./types";

export const VARIANTS: Record<VariantId, VariantDefinition> = {
  classic: { id: "classic", name: "Classic 9×9", description: "The timeless row, column and 3×3 discipline.", size: 9, boxRows: 3, boxCols: 3 },
  diagonal: { id: "diagonal", name: "Crosswind", description: "Both long diagonals must also hold 1–9.", size: 9, boxRows: 3, boxCols: 3, diagonal: true },
  mini: { id: "mini", name: "Pocket 6×6", description: "A brisk board with 2×3 regions.", size: 6, boxRows: 2, boxCols: 3 },
  chromatic: { id: "chromatic", name: "Chromatic", description: "Classic rules with a colour trail for every digit.", size: 9, boxRows: 3, boxCols: 3, chromatic: true },
};

export const DIFFICULTIES: { id: Difficulty; label: string; description: string }[] = [
  { id: "wanderer", label: "Wanderer", description: "Generous clues" },
  { id: "adept", label: "Adept", description: "Balanced deduction" },
  { id: "master", label: "Master", description: "Sparse and exacting" },
  { id: "legend", label: "Legend", description: "Deep chains" },
];

export const MODES: { id: GameMode; label: string; description: string }[] = [
  { id: "campaign", label: "Campaign", description: "Cross six gates and unlock mastery." },
  { id: "quick", label: "Quick Play", description: "Choose any board and difficulty." },
  { id: "daily", label: "Daily Trial", description: "One shared seed for today." },
  { id: "zen", label: "Zen", description: "No score pressure or mistake count." },
  { id: "sprint", label: "Five-Minute Sprint", description: "Solve before the bell." },
];

export interface CampaignNode {
  id: string;
  gate: number;
  title: string;
  variant: VariantId;
  difficulty: Difficulty;
  reward: number;
}

export const CAMPAIGN: CampaignNode[] = [
  { id: "g1-1", gate: 1, title: "First Footstep", variant: "mini", difficulty: "wanderer", reward: 180 },
  { id: "g1-2", gate: 1, title: "Open Hand", variant: "classic", difficulty: "wanderer", reward: 240 },
  { id: "g2-1", gate: 2, title: "Quiet Current", variant: "classic", difficulty: "adept", reward: 320 },
  { id: "g2-2", gate: 2, title: "Painted Current", variant: "chromatic", difficulty: "adept", reward: 360 },
  { id: "g3-1", gate: 3, title: "Crossing Wind", variant: "diagonal", difficulty: "wanderer", reward: 420 },
  { id: "g3-2", gate: 3, title: "Twin Paths", variant: "diagonal", difficulty: "adept", reward: 500 },
  { id: "g4-1", gate: 4, title: "Empty Lantern", variant: "classic", difficulty: "master", reward: 620 },
  { id: "g4-2", gate: 4, title: "Verdant Cipher", variant: "chromatic", difficulty: "master", reward: 680 },
  { id: "g5-1", gate: 5, title: "Ninefold Echo", variant: "diagonal", difficulty: "master", reward: 780 },
  { id: "g5-2", gate: 5, title: "Unbroken Seal", variant: "classic", difficulty: "legend", reward: 900 },
  { id: "g6-1", gate: 6, title: "The Sixth Gate", variant: "diagonal", difficulty: "legend", reward: 1080 },
  { id: "g6-2", gate: 6, title: "Keeper of Nine", variant: "chromatic", difficulty: "legend", reward: 1200 },
];
