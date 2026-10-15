import type { VariantDefinition } from "../../src/game/types";

/** Test oracle: checks constraints directly, without the game's solver/groups. */
export function solutionCount(input: number[], variant: VariantDefinition): number {
  const { size, boxRows, boxCols, diagonal } = variant;
  if (input.length !== size * size || input.some(value => !Number.isInteger(value) || value < 0 || value > size)) return 0;
  const grid = [...input];
  const allowed = (index: number, value: number): boolean => {
    const row = Math.floor(index / size), col = index % size;
    for (let other = 0; other < grid.length; other++) {
      if (other === index || grid[other] !== value) continue;
      const r = Math.floor(other / size), c = other % size;
      if (r === row || c === col ||
          (Math.floor(r / boxRows) === Math.floor(row / boxRows) && Math.floor(c / boxCols) === Math.floor(col / boxCols)) ||
          (diagonal && row === col && r === c) ||
          (diagonal && row + col === size - 1 && r + c === size - 1)) return false;
    }
    return true;
  };
  if (grid.some((value, index) => value !== 0 && !allowed(index, value))) return 0;
  let count = 0;
  const visit = (): void => {
    if (count >= 2) return;
    let target = -1, choices: number[] = [];
    for (let index = 0; index < grid.length; index++) {
      if (grid[index] !== 0) continue;
      const candidates = Array.from({ length: size }, (_, i) => i + 1).filter(value => allowed(index, value));
      if (candidates.length === 0) return;
      if (target < 0 || candidates.length < choices.length) { target = index; choices = candidates; }
      if (choices.length === 1) break;
    }
    if (target < 0) { count++; return; }
    for (const value of choices) {
      grid[target] = value;
      visit();
      grid[target] = 0;
      if (count >= 2) return;
    }
  };
  visit();
  return count;
}
