import { describe, expect, it } from "vitest";
import { VARIANTS } from "../src/game/presets";
import { createPuzzle } from "../src/game/sudoku";
import { solutionCount } from "./helpers/independent-solver";

describe("standard classic puzzle set", () => {
  it.each(["standard-a", "standard-b", "standard-c", "standard-d"])("%s is a uniquely solvable 9×9", seed => {
    const { puzzle, solution } = createPuzzle(VARIANTS.classic, "wanderer", seed);
    expect(puzzle).toHaveLength(81);
    expect(solutionCount(puzzle, VARIANTS.classic)).toBe(1);
    expect(solutionCount(solution, VARIANTS.classic)).toBe(1);
    puzzle.forEach((value, index) => { if (value) expect(value).toBe(solution[index]); });
  });
});
