import { describe, expect, it } from "vitest";
import { VARIANTS } from "../src/game/presets";
import { calculateReward, countSolutions, createPuzzle, isValidSolution } from "../src/game/sudoku";

describe("Sudoku generation", () => {
  it.each([
    ["classic", VARIANTS.classic],
    ["mini", VARIANTS.mini],
    ["diagonal", VARIANTS.diagonal],
    ["chromatic", VARIANTS.chromatic],
  ] as const)("creates a valid, unique %s puzzle", (_name, variant) => {
    const generated = createPuzzle(variant, "adept", `test:${variant.id}`);
    expect(isValidSolution(generated.solution, variant)).toBe(true);
    expect(generated.puzzle.some((value) => value === 0)).toBe(true);
    expect(countSolutions(generated.puzzle, variant, 2)).toBe(1);
  });

  it("rewards cleaner, faster solves", () => {
    expect(calculateReward(300, 90, 0, 0)).toBeGreaterThan(calculateReward(300, 300, 2, 1));
    expect(calculateReward(10, 9999, 99, 99)).toBe(25);
  });
});
