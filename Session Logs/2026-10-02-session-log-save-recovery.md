---
title: Session Log - Save Recovery
date: 2026-10-02
created: 2026-10-02
status: complete
type: session-log
mutability: append-only
owner: Alexei Udall
project: Rokumon Sudoku
agent: Codex
tags:
  - session-log
---

# Save recovery sweep

## Executive Summary

Malformed local progress could prevent the board from mounting, and a blocked storage write could interrupt completion or theme changes. Progress loading now validates individual fields, and storage failures leave the current session playable. Game shortcuts also leave open dialogs alone so keyboard navigation does not remove the dialog or edit the board behind it.

## Trigger

The owner requested a gaming-project improvement sweep with focused repairs and pull requests.

## Starting State

- Clean `main` checkout at `6d310e7`, aligned with `origin/main`.
- Phaser 4, TypeScript, Vite and Vitest. No open pull requests.
- Progress was merged directly from parsed JSON. Fresh loads shared the default completed-node array.

## Work Completed

- Validate numeric counters, campaign bounds, node IDs, theme and calendar date without discarding neighbouring valid fields.
- Give every fresh load its own completed-node collection.
- Catch unavailable or full browser storage during writes.
- Add 10 persistence regressions. Five failed against the original implementation.
- Ignore gameplay keyboard shortcuts while a dialog is open. A browser regression reproduced ArrowRight closing the New puzzle dialog before the guard was added.

## Decisions

| Decision | Reason | Revisit When |
|---|---|---|
| Retain the current key and progress format | Existing valid saves continue working | A schema migration is needed |
| Recover fields individually | A broken theme or counter should not discard valid player progress | Save corruption needs a player-facing recovery notice |
| Keep scope on reliability | More modes or campaign content would not address this defect | Existing campaign teaching beats have player feedback |

## Files Touched

- `src/game/store.ts`: validation and non-blocking writes.
- `src/ui/app.ts`: keyboard shortcut boundary for open dialogs.
- `tests/store.test.ts`: persistence regressions.
- `tests/evidence/2026-10-02-*`: desktop/mobile recovery and completion captures.
- This session log and the session-log index.

## Verification

- `npm run verify`: 15 tests passed; TypeScript check and production build passed.
- `git diff --check`: passed.
- Headless Chrome: a malformed save with an out-of-range campaign index, null node list and invalid counters/theme boots into a playable 81-cell grid.
- At 375 x 812, the board and number pad fit without horizontal page overflow.
- With New puzzle open, ArrowRight and H preserve the dialog and leave gameplay alone.
- A storage override throwing `QuotaExceededError` does not block completing the first campaign puzzle through 16 keyboard hints. The result dialog appears and replay creates a fresh board. This proves the completion path, not unassisted solving or balance.
- No console errors in the targeted browser path.

Evidence: [browser checks](../tests/evidence/2026-10-02-sweep-smoke.json), [desktop](../tests/evidence/2026-10-02-save-recovery-desktop.png), [mobile](../tests/evidence/2026-10-02-save-recovery-mobile.png), [keyboard dialog](../tests/evidence/2026-10-02-keyboard-dialog.png), [completion](../tests/evidence/2026-10-02-blocked-save-completion.png).

## Open Threads

- Physical touch testing, Firefox/Safari and full accessibility coverage remain release gates.
- Saved progress survives reload; the current puzzle itself is still not resumed after refresh. Decide this behaviour before a longer campaign release.
- The browser slice has a working loop; this sweep does not promote its stage or validate difficulty labels and retention.

## Connected

- `docs/PROJECT_BRIEF.md`
- `docs/SAVE_AND_STATE.md`
- `Templates/PLAYTEST_CHECKLIST.md`
