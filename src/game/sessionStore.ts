import { CAMPAIGN, DIFFICULTIES, MODES, VARIANTS } from "./presets";
import { createSession, type Move, type Session } from "./session";
import { normaliseProgress } from "./store";
import { calculateReward } from "./sudoku";
import type { Difficulty, GameMode, PlayerProgress, VariantId } from "./types";

export const SESSION_STORAGE_KEY = "rokumon-sudoku-active-v1";
const MAX_SAVE_LENGTH = 1_000_000;
const RECOVERY_NOTICE = "Your saved puzzle could not be restored. A fresh campaign puzzle is ready.";

export interface ActiveState {
  session: Session;
  progress: PlayerProgress;
}

export interface RestoreResult {
  state?: ActiveState;
  notice?: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function counter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sameNumbers(value: unknown, expected: number[]): boolean {
  return Array.isArray(value) && value.length === expected.length && value.every((digit, index) => digit === expected[index]);
}

function readNotes(value: unknown, size: number): number[] | undefined {
  if (!Array.isArray(value) || value.length > size || !value.every(digit => counter(digit) && digit >= 1 && digit <= size)) return;
  if (new Set(value).size !== value.length) return;
  return [...value] as number[];
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

// Regenerate the puzzle before accepting any entries or undo records. Stored clues
// detect generator changes; a stored solution or reward base is never trusted.
export function decodeActiveState(raw: string): ActiveState | undefined {
  try {
    if (raw.length > MAX_SAVE_LENGTH) return;
    const saved: unknown = JSON.parse(raw);
    if (!object(saved) || saved.version !== 1 || !object(saved.session) || !object(saved.progress)) return;
    const progress = normaliseProgress(saved.progress);
    for (const key of Object.keys(progress) as (keyof PlayerProgress)[]) {
      if (JSON.stringify(saved.progress[key]) !== JSON.stringify(progress[key])) return;
    }
    if (saved.progress.lastPlayedDate !== progress.lastPlayedDate) return;
    const value = saved.session;
    if (typeof value.variant !== "string" || !Object.hasOwn(VARIANTS, value.variant)
      || !DIFFICULTIES.some(difficulty => difficulty.id === value.difficulty)
      || !MODES.some(mode => mode.id === value.mode)
      || typeof value.seed !== "string" || value.seed.length === 0 || value.seed.length > 200) return;
    const variant = value.variant as VariantId;
    const difficulty = value.difficulty as Difficulty;
    const mode = value.mode as GameMode;
    let campaignIndex: number | undefined;
    if (mode === "campaign") {
      if (!counter(value.campaignIndex) || value.campaignIndex > progress.campaignUnlocked) return;
      campaignIndex = value.campaignIndex;
      const node = CAMPAIGN[campaignIndex];
      if (!node || variant !== node.variant || difficulty !== node.difficulty || value.seed !== `campaign:${node.id}`) return;
    } else if (value.campaignIndex !== undefined) return;
    if (mode === "daily" && (variant !== "diagonal" || difficulty !== "adept"
      || !value.seed.startsWith("daily:") || !validDate(value.seed.slice(6)))) return;
    const session = createSession(variant, difficulty, mode, value.seed, campaignIndex);
    const { puzzle, solution } = session.generated;
    const size = session.generated.variant.size;
    const validEntry = (entry: unknown, index: number) => counter(entry)
      && (puzzle[index] !== 0 ? entry === puzzle[index] : entry === 0 || entry === solution[index]);
    if (!sameNumbers(value.clues, puzzle) || !Array.isArray(value.entries) || value.entries.length !== puzzle.length
      || !value.entries.every(validEntry) || !Array.isArray(value.notes) || value.notes.length !== puzzle.length) return;
    const notes = value.notes.map(note => readNotes(note, size));
    if (notes.some((note, index) => !note || (value.entries as number[])[index] !== 0 && note.length !== 0)) return;
    if (typeof value.selected !== "number" || !Number.isInteger(value.selected) || value.selected < -1 || value.selected >= puzzle.length
      || typeof value.noteMode !== "boolean" || !counter(value.elapsed) || !counter(value.mistakes) || !counter(value.hints)
      || !Array.isArray(value.history)) return;
    const history: Move[] = [];
    for (const move of value.history) {
      if (!object(move) || !counter(move.index) || move.index >= puzzle.length || puzzle[move.index] !== 0
        || !validEntry(move.entry, move.index)) return;
      const priorNotes = readNotes(move.notes, size);
      if (!priorNotes || move.entry !== 0 && priorNotes.length !== 0) return;
      history.push({ index: move.index, entry: move.entry as number, notes: priorNotes });
    }
    // A complete undo stack must lead back to the regenerated initial board.
    const initialEntries = [...value.entries] as number[];
    const initialNotes = notes.map(note => [...note!]);
    for (const move of [...history].reverse()) {
      initialEntries[move.index] = move.entry;
      initialNotes[move.index] = move.notes;
    }
    if (!sameNumbers(initialEntries, puzzle) || initialNotes.some(note => note.length !== 0)) return;
    if (value.status !== "playing" && value.status !== "complete" && value.status !== "failed") return;
    const solved = (value.entries as number[]).every((entry, index) => entry === solution[index]);
    if (value.status === "complete" ? !solved : solved) return;
    if (mode === "sprint" && (value.elapsed > 300 || (value.status === "failed" ? value.elapsed !== 300 : value.status === "playing" && value.elapsed >= 300))) return;
    if (value.status === "failed" && mode !== "sprint") return;
    const reward = mode === "zen" ? 0 : calculateReward(session.rewardBase, value.elapsed, value.mistakes, value.hints);
    if (value.status === "complete" ? value.reward !== reward : value.reward !== undefined) return;
    Object.assign(session, {
      entries: [...value.entries], notes: notes.map(note => new Set(note)), selected: value.selected,
      noteMode: value.noteMode, elapsed: value.elapsed, mistakes: value.mistakes, hints: value.hints,
      history, status: value.status,
      ...(value.status === "complete" ? { reward } : {}),
    });
    return { session, progress };
  } catch {
    return;
  }
}

export function encodeActiveState(session: Session, progress: PlayerProgress): string {
  return JSON.stringify({
    version: 1,
    progress,
    session: {
      variant: session.generated.variant.id, difficulty: session.generated.difficulty,
      mode: session.mode, seed: session.generated.seed, campaignIndex: session.campaignIndex,
      clues: session.generated.puzzle, entries: session.entries, notes: session.notes.map(note => [...note]),
      selected: session.selected, noteMode: session.noteMode, elapsed: session.elapsed,
      mistakes: session.mistakes, hints: session.hints, history: session.history,
      status: session.status, reward: session.reward,
    },
  });
}

export function loadActiveState(legacyProgress: PlayerProgress): RestoreResult {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return {};
    const state = decodeActiveState(raw);
    if (!state) return { notice: RECOVERY_NOTICE };
    if (legacyProgress.points > state.progress.points || legacyProgress.solved > state.progress.solved
      || legacyProgress.campaignUnlocked > state.progress.campaignUnlocked) {
      return { notice: "Your progress changed since this puzzle was saved. A fresh campaign puzzle is ready." };
    }
    return { state };
  } catch {
    return {};
  }
}

export function saveActiveState(session: Session, progress: PlayerProgress): boolean {
  try {
    const raw = encodeActiveState(session, progress);
    if (raw.length > MAX_SAVE_LENGTH) return false;
    localStorage.setItem(SESSION_STORAGE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}
