import type { Difficulty, GeneratedPuzzle, VariantDefinition } from "./types";

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildConstraintGroups(definition: VariantDefinition): number[][] {
  const { size, boxRows, boxCols } = definition;
  const groups: number[][] = [];
  for (let row = 0; row < size; row += 1) groups.push(Array.from({ length: size }, (_, col) => row * size + col));
  for (let col = 0; col < size; col += 1) groups.push(Array.from({ length: size }, (_, row) => row * size + col));
  for (let row = 0; row < size; row += boxRows) {
    for (let col = 0; col < size; col += boxCols) {
      groups.push(Array.from({ length: size }, (_, offset) => (row + Math.floor(offset / boxCols)) * size + col + (offset % boxCols)));
    }
  }
  if (definition.diagonal) {
    groups.push(Array.from({ length: size }, (_, index) => index * size + index));
    groups.push(Array.from({ length: size }, (_, index) => index * size + (size - 1 - index)));
  }
  return groups;
}

function peersByCell(definition: VariantDefinition): number[][] {
  const groups = buildConstraintGroups(definition);
  return Array.from({ length: definition.size ** 2 }, (_, index) => {
    const peers = new Set<number>();
    for (const group of groups) if (group.includes(index)) group.forEach((cell) => cell !== index && peers.add(cell));
    return [...peers];
  });
}

function solveBoard(board: number[], definition: VariantDefinition, random: () => number, limit = 1): number[][] {
  const size = definition.size;
  const peers = peersByCell(definition);
  const results: number[][] = [];

  const visit = (): void => {
    if (results.length >= limit) return;
    let target = -1;
    let candidates: number[] = [];
    for (let index = 0; index < board.length; index += 1) {
      if (board[index] !== 0) continue;
      const used = new Set(peers[index].map((peer) => board[peer]).filter(Boolean));
      const available = Array.from({ length: size }, (_, offset) => offset + 1).filter((value) => !used.has(value));
      if (available.length === 0) return;
      if (target < 0 || available.length < candidates.length) {
        target = index;
        candidates = available;
        if (available.length === 1) break;
      }
    }
    if (target < 0) {
      results.push([...board]);
      return;
    }
    for (const value of shuffled(candidates, random)) {
      board[target] = value;
      visit();
      board[target] = 0;
      if (results.length >= limit) return;
    }
  };

  visit();
  return results;
}

export function countSolutions(board: number[], definition: VariantDefinition, limit = 2): number {
  return solveBoard([...board], definition, seededRandom("count-solutions"), limit).length;
}

export function isValidSolution(board: number[], definition: VariantDefinition): boolean {
  const target = Array.from({ length: definition.size }, (_, index) => index + 1).join(",");
  return buildConstraintGroups(definition).every((group) => [...group.map((index) => board[index])].sort((a, b) => a - b).join(",") === target);
}

function targetClues(definition: VariantDefinition, difficulty: Difficulty): number {
  const ratios: Record<Difficulty, number> = { wanderer: 0.56, adept: 0.45, master: 0.37, legend: 0.32 };
  return Math.max(definition.size + 2, Math.round(definition.size ** 2 * ratios[difficulty]));
}

export function createPuzzle(definition: VariantDefinition, difficulty: Difficulty, seed: string): GeneratedPuzzle {
  const random = seededRandom(`${seed}:solution`);
  const empty = Array(definition.size ** 2).fill(0);
  const solution = solveBoard(empty, definition, random, 1)[0];
  if (!solution) throw new Error(`Could not generate ${definition.name}.`);
  const puzzle = [...solution];
  const indexes = shuffled(Array.from({ length: puzzle.length }, (_, index) => index), seededRandom(`${seed}:carve`));
  const goal = targetClues(definition, difficulty);
  let clues = puzzle.length;
  for (const index of indexes) {
    if (clues <= goal) break;
    const previous = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle, definition, 2) !== 1) puzzle[index] = previous;
    else clues -= 1;
  }
  return { puzzle, solution, seed, variant: definition, difficulty };
}

export function cellSharesGroup(a: number, b: number, definition: VariantDefinition): boolean {
  return buildConstraintGroups(definition).some((group) => group.includes(a) && group.includes(b));
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function calculateReward(base: number, elapsedSeconds: number, mistakes: number, hints: number): number {
  return Math.max(25, base + Math.max(0, 240 - elapsedSeconds) - mistakes * 45 - hints * 70);
}
