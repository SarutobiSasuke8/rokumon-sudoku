# Project brief

## Summary

**Rokumon Sudoku** — selected public working title. **The Six Gates** remains the campaign name. Formal trademark clearance is still required.

## Vibe

Refined, tactile, quietly adventurous, and Japanese-inspired without becoming
costume or clutter. Warm paper, dark ink, restrained vermilion, precise rules,
and subtle ambient motion frame a board that stays visually dominant.

## User

- Casual players who want a calm five-minute puzzle.
- Sudoku regulars who want variant depth and measurable mastery.
- Rokumon Games players who expect a polished, game-like wrapper around a familiar ruleset.

## Problem

Most browser Sudoku experiences are either disposable grids or ad-heavy utilities.
They offer little sense of journey, ownership, or meaningful return progression.

## Product Promise

Turn Sudoku from a disposable grid into a returnable puzzle adventure. The first screen is immediately playable, while a visible campaign trail, points, ranks, themes, variants, streaks and short-session modes give players reasons to return.

## Core Workflows

- Start the next unlocked campaign gate and advance the trail.
- Quick-create a mode, variant, and difficulty combination.
- Enter digits by keyboard or touch; toggle notes, undo, erase, or request a hint.
- Complete a valid grid, earn points, increase streak, and unlock progression.
- Change theme without interrupting the current puzzle.

## Success Criteria

A responsive vertical slice with a valid unique puzzle, touch and keyboard input, notes, undo, hints, success feedback, scoring, persistent campaign progression, multiple quick-create variants, selectable themes, and hub events.

## Non-Goals

- Multiplayer, chat, subscriptions, and server accounts in the vertical slice.
- A procedurally infinite campaign before puzzle-quality curation exists.
- Cosmetic monetisation before retention and accessibility are proven.

## Constraints

- Browser and mobile compatibility down to 320 CSS pixels.
- Static-hostable relative build suitable for Rokumon Games ingestion.
- Offline-first local progression for the vertical slice.
- No external art dependency; the visual system is procedural and CSS-led.

## Quality Gates

- Every generated puzzle is valid and has one solution.
- Core interaction works by keyboard, mouse, and touch.
- No horizontal overflow at 320, 375, 414, or 768 CSS pixels.
- Completion, scoring, campaign unlock, and persistence are visibly verifiable.
- Production bundle builds without errors and browser console remains clean.

## Technical Notes

- Phaser owns the ambient canvas layer and celebration effects.
- DOM owns the semantic grid, controls, dialogs, and responsive layout.
- Generation and rules are rendering-independent TypeScript modules.
- Local storage holds progression and selected theme.
- Rokumon host integration is isolated behind guarded custom events.

## Open Questions

- Which 36 authored puzzles and teaching beats define the first campaign release?
- Should Daily mode share one server-issued seed or a deterministic local date seed?
- Which title clears formal trademark and store-search review?
- What minimum retention evidence earns catalogue promotion?

## Experience Principles

1. The grid is always the visual and interaction priority.
2. Campaign flavour creates momentum without obscuring logic.
3. Assistance has a transparent score cost; Zen mode removes pressure.
4. Every puzzle is deterministic from its seed and uniquely solvable.
5. Colour supports digits but never replaces them.
