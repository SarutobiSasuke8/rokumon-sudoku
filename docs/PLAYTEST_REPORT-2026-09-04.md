---
title: Playtest Report - 2026-09-04 Vertical Slice
date: 2026-09-04
build: local Vite development build
stage_under_review: vertical slice
---

# Playtest Report - 2026-09-04 Vertical Slice

## Scope

- Main question: Is the first slice a coherent, playable Sudoku game across desktop and mobile rather than a static prototype?
- Build / commit: Uncommitted local vertical slice.
- Tester: Codex automated browser operator with visual review.
- Device, browser, and viewport: Chromium at 320, 375, 414, 768, and desktop widths.
- Input method: Pointer/touch emulation and keyboard.

## Evidence

- Deterministic smoke path: pass.
- Screenshots / recording: Visual captures reviewed during the browser pass at all target widths.
- Console / network errors: No console warnings or errors after play and navigation.
- Performance observation: Immediate interaction and puzzle creation on the test machine; production build warns that the Phaser-containing JavaScript chunk is larger than 500 kB.

## Findings

| Severity | What the player sees | Reproduction | Likely owner | Follow-up |
|---|---|---|---|---|
| Fixed | Completion dialog primary action initially lost contrast | Complete a puzzle using hints | UI | Explicitly apply accent ink to result primary action |
| Low | The first campaign currently uses generated seeds rather than hand-authored teaching boards | Enter Campaign | Design | Curate and technique-grade the release campaign |
| Low | Dense 9×9 cells are necessarily below the general 44 px target at 320 px | Open a 9×9 board at 320 px | Accessibility | Add optional large-board focus/zoom mode |
| Low | Phaser ships in the initial bundle despite only powering ambient presentation | Run production build | Engineering | Lazy-load or isolate the ambient scene before release |

## Checklist Result

- Core loop: pass — start, solve, complete, score, replay, and campaign advance verified.
- Input and feel: pass — selection, digit entry, notes, erase, undo, hint, wrong-entry feedback, and keyboard mapping verified.
- Playfield and UI: pass — grid remains clear in Parchment and Midnight; completion action contrast fixed and rechecked.
- Stability: pass — generated Classic, Crosswind, Pocket, and Chromatic puzzles pass uniqueness tests; browser console is clean.
- Mobile / accessibility: pass with issue — no horizontal overflow at the four required widths; large-board zoom remains a release follow-up.

## Verdict

`pass with issues`

The vertical slice is ready for owner playtesting and content development. It is not yet a catalogue release candidate.

## Next Action

Run five uncoached player sessions, then curate the first six campaign puzzles around observed difficulty and assistance use.
