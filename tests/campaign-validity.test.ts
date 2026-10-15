import { describe, expect, it } from "vitest";
import { CAMPAIGN, VARIANTS } from "../src/game/presets";
import { createPuzzle } from "../src/game/sudoku";
import { solutionCount } from "./helpers/independent-solver";

describe("all campaign puzzles", () => {
  // The catalogue bundles seeds, rather than literal grids. Match startCampaign's exact seed.
  it.each(CAMPAIGN)("$id: $title has consistent givens and exactly one solution", node => {
    const variant = VARIANTS[node.variant];
    const { puzzle, solution } = createPuzzle(variant, node.difficulty, `campaign:${node.id}`);
    expect(puzzle).toHaveLength(variant.size ** 2);
    expect(puzzle.some(value => value === 0)).toBe(true);
    expect(puzzle.some(value => value !== 0)).toBe(true);
    for (let index = 0; index < puzzle.length; index++) {
      expect(Number.isInteger(puzzle[index])).toBe(true);
      expect(puzzle[index]).toBeGreaterThanOrEqual(0);
      expect(puzzle[index]).toBeLessThanOrEqual(variant.size);
      if (puzzle[index] !== 0) expect(puzzle[index]).toBe(solution[index]);
    }
    expect(solution.every(value => value >= 1 && value <= variant.size)).toBe(true);
    expect(solutionCount(solution, variant), "generated full grid is valid").toBe(1);
    expect(solutionCount(puzzle, variant), "campaign puzzle must be unique").toBe(1);
  }, 60_000);

  it("the independent oracle rejects conflicting givens and recognises ambiguity", () => {
    const { solution } = createPuzzle(VARIANTS.mini, "wanderer", "oracle");
    const duplicate = [...solution]; duplicate[1] = duplicate[0];
    expect(solutionCount(duplicate, VARIANTS.mini)).toBe(0);
    expect(solutionCount(Array(36).fill(0), VARIANTS.mini)).toBe(2);
    expect(solutionCount([1], VARIANTS.mini)).toBe(0);
  });
});
