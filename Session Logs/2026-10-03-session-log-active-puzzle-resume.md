---
title: Session Log - Active Puzzle Resume
date: 2026-10-03
created: 2026-10-03
status: complete
type: session-log
mutability: append-only
owner: Alexei Udall
project: Rokumon Sudoku
agent: Codex
tags:
  - session-log
---

# Active puzzle resume

## Executive Summary

Refreshing the page discarded the current puzzle, entries and pencil marks even though player progression survived. The game now restores a validated active checkpoint, including undo history, selection, tools, counters, elapsed play time and terminal results. Completion and its progression share one storage write so a failed legacy mirror write cannot replay a reward.

## Trigger and Starting State

- The owner authorised the first polish batch, including active-puzzle resume.
- Clean `codex/gaming-sweep-2026-10-02` at `e83e6e431180502d6f4e0d084265d0b6f36e1ab4`, the head of open PR #1.
- Work branch: `codex/sudoku-active-puzzle-resume-2026-10-03`, based on that exact head. The follow-up PR targets PR #1's branch and depends on its save-recovery changes.
- Baseline reproduction: place an actual hint with H, refresh, and compare the DOM board. The new browser regression failed because the entered 3 was replaced by 0.

## Acceptance and Work Completed

- Regenerate from variant, difficulty, seed and mode before restoring entries. Compare saved clues; reject malformed identities, givens, values, notes, incomplete undo stacks and inconsistent terminal states.
- Restore campaign state and player progression alongside the board, full undo history, selected cell, note mode, timer, mistakes and hints.
- Preserve the original flat progression key/format. Mirror completion and theme changes only after the atomic active checkpoint succeeds.
- Persist meaningful changes immediately, time every 5 active seconds, and the final count on page hide/visibility hide. Catch unavailable or full storage and display a save notice while play continues in memory.
- Resume completed/failed trials as terminal without awarding again. Terminal Undo and Hint leave the saved history unchanged.
- Prevent note-mode digit input from creating hidden notes on filled cells, which would otherwise produce an invalid checkpoint.
- Add 49 persistence cases and a repeatable real Chrome/CDP browser smoke script with a disposable profile.

## Decisions

| Decision | Reason | Limit |
|---|---|---|
| Visible, dialog-free active seconds | A puzzle menu or a closed tab should not consume a Sprint | Existing one-second timer granularity remains |
| No offline catch-up | Resume continues the saved amount of active play | Abrupt process termination may lose up to 4 displayed seconds since the last successful checkpoint |
| Retain an older unfinished Daily | Changing the date should not discard a player's grid | Its original UTC date is in the title; choosing Daily starts today's seed |
| Atomic session/progression checkpoint | Separate writes could leave new points next to an older playable board | Local convenience storage; no cross-tab merge or anti-cheat guarantees |
| Strict rejection with a visible fresh-board notice | A changed generator or truncated save must not reinterpret player input | Oversized snapshots above 1,000,000 characters fail safely; physical-device long-session sizing remains open |

## Files Touched

- `src/game/session.ts` and `src/game/sessionStore.ts`: plain state, serialisation, regeneration and restoration validation.
- `src/game/store.ts`: reuse the existing progression normalisation with unchanged legacy format.
- `src/ui/app.ts`: restore, checkpoint lifecycle, paused timers and terminal guards.
- `tests/sessionStore.test.ts`, `scripts/session-smoke.mjs`, `package.json`: persistence and browser regression checks.
- Save/state, architecture, input map, TODO and session index; dated screenshots and browser result JSON.

## Verification

- `npm run verify`: 64 tests pass, including 49 new checkpoint cases; TypeScript check and production build pass. The existing large Phaser bundle warning remains.
- `git diff --check`: passes.
- `node scripts/session-smoke.mjs --evidence=2026-10-03`: 13 targeted browser checks pass with no console errors.
- The browser path uses real keyboard and DOM button actions for notes, a wrong digit, hints, undo, modal pause, completion and refresh. It proves both visible state and persisted assistance/history counters.
- A legacy-only quota failure still restores completed progress, campaign unlock and a terminal board. Two completed refreshes plus Hint/Undo leave rewards unchanged.
- A failure of all storage writes permits completion in memory, shows a save notice and keeps persisted rewards behind the last accepted checkpoint.
- Truncated JSON and clues recover visibly while preserving valid legacy progression.
- Old Daily identity remains stable; the Daily action starts today's UTC puzzle. Sprint resumes at 2 active seconds remaining, fails at 300 elapsed seconds and remains failed after refresh.
- 375 x 812 emulated mobile checks cover button entry, refresh and horizontal fit. The dated Daily heading also fits. Desktop checks use 1440 x 900.
- The visibility-hidden branch is exercised by overriding `document.hidden` and dispatching the lifecycle event; it is a branch check rather than a physical background-tab/device-sleep test.

Evidence: [browser result](../tests/evidence/2026-10-03-resume-smoke.json), [before refresh](../tests/evidence/2026-10-03-resume-desktop-before-refresh.png), [after refresh](../tests/evidence/2026-10-03-resume-desktop-after-refresh.png), [mobile](../tests/evidence/2026-10-03-resume-mobile-after-refresh.png), [dated Daily](../tests/evidence/2026-10-03-resume-dated-daily-mobile.png), [paused menu](../tests/evidence/2026-10-03-resume-paused-menu.png), [completion](../tests/evidence/2026-10-03-resume-completed.png), [failed Sprint](../tests/evidence/2026-10-03-resume-failed-sprint.png), [corrupt save](../tests/evidence/2026-10-03-resume-corrupt-recovery.png), [blocked storage](../tests/evidence/2026-10-03-resume-blocked-storage.png).

## Playtest Gate

- [x] Boots into a playable board or restored terminal result.
- [x] Keyboard/pointer core controls, note mode, undo and Hint work through refresh.
- [x] Success, Sprint failure and explicit fresh-trial actions remain coherent.
- [x] Open menus preserve game input state and pause the active clock.
- [x] Desktop and emulated mobile layouts remain legible and resize without overflow.
- [x] Targeted start/play/win-or-fail/reload loops have no browser console errors.
- [x] Representative active, menu, success, failure and recovery screenshots are recorded and reviewed.
- [ ] Physical touch, orientation/safe-area, Firefox/Safari, real background-tab/device sleep and complete screen-reader coverage.
- [ ] Unassisted solve, campaign balance, frame-rate profiling and long-session storage/device performance.

Verdict: targeted resume acceptance passes with the stated device and release limits. No stage promotion, merge or deployment.

## Open Threads

- Physical mobile and cross-browser resume checks remain release work in `TODO.md`.
- Long sessions should be measured against the checkpoint storage budget. Changes rejected by the browser cannot be restored after reload.
- Simultaneous tabs and edits through an older client are outside this batch; newer legacy counters/unlocks trigger a safe fresh board.

## What Worked and What To Do Differently

- Start with an actual player input/refresh reproduction and test the secondary progression-write failure separately from all-write failure.
- Inject corrupt fixtures at the next document boot. The old page's final lifecycle checkpoint would otherwise correctly overwrite a deliberately modified live storage record.
- Keep source changes sequential with the browser pass: Vite reloads during verification can invalidate page-load waits. Compare timer ranges around refresh rather than treating an extra active second before page hide as data loss.

## Connected

- `docs/SAVE_AND_STATE.md`
- `docs/ARCHITECTURE.md`
- `Templates/INPUT_CONTROL_MAP.md`
- `Templates/PLAYTEST_CHECKLIST.md`
- `Session Logs/2026-10-02-session-log-save-recovery.md`
