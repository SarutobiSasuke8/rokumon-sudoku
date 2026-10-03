# Save and State Contract

- Save only serializable simulation state and user preferences; never Phaser, Three.js, DOM, or audio objects.
- Version every persisted schema. On a version mismatch, migrate deliberately or reset safely with a visible explanation.
- Test game-over and restart from a clean state: score, entities, input, timers, audio, UI, and progression must agree.
- Keep debug snapshots readable enough to diagnose a failed smoke path.
- Treat local storage as untrusted convenience data; validate parsed values and tolerate corruption.

## Active puzzle resume

`rokumon-sudoku-active-v1` contains `{ version: 1, progress, session }`. The session stores variant, difficulty, mode, seed, original clues, entries, pencil notes, the complete undo stack, selected cell, note mode, elapsed seconds, mistakes, hints, campaign index and terminal status/reward. It contains no rendering objects or supplied solution.

On boot, regenerate the deterministic puzzle and compare its clues. Accept only entries consistent with those clues and solution, bounded valid pencil marks and undo records that lead back to the initial board. Validate the campaign identity/unlock and terminal state. Unknown versions, malformed/truncated records and changed generator output start a fresh campaign puzzle with a visible explanation. Snapshots larger than 1,000,000 characters are rejected, and writes above that budget fail safely.

The existing `rokumon-sudoku-progress-v1` key and its flat progression format remain supported. The active checkpoint stores the board and its progression in one atomic storage write. After completion or a theme change, update the legacy mirror only after the active write succeeds. A failed mirror write therefore still restores the terminal board and earned progress; a failed active write leaves both persisted awards and the previous checkpoint unchanged. If legacy counters or campaign unlocks are newer than the checkpoint, preserve that progression and start a fresh puzzle rather than reviving the older board. This is local convenience storage, not a cross-tab conflict-resolution or anti-cheat system.

Restoring a completed or failed board displays its result without running completion, adding points, incrementing solves or sending another completion event. Terminal Undo and Hint leave the board and history unchanged. Explicit Replay begins a new attempt under the existing scoring rules.

## Timer and lifecycle

- Timers count whole seconds of visible, dialog-free active play. Hidden documents and open game dialogs pause the clock. Closing the tab, sleeping the device or spending time away from the game does not add offline time on the next boot.
- Daily trials use UTC dates. An unfinished older Daily keeps its original seed and dated title when resumed. Choosing Daily explicitly starts today's UTC puzzle.
- Sprint resumes the saved elapsed count and has 300 active seconds in total. At 300 seconds it persists a failed terminal state with no reward.
- Every meaningful state change saves immediately. Time alone checkpoints every 5 active seconds; `visibilitychange` to hidden and `pagehide` save the final count. An abrupt process kill can lose up to 4 displayed elapsed seconds since the last successful checkpoint. The timer retains its existing one-second interval granularity.
- Blocked reads fall back to the existing progression/new-puzzle path. Blocked or quota-limited writes show a save notice and leave play usable in memory. Reload cannot recover changes that the browser never accepted.

## Verification

Run `npm run verify`, then `npm run smoke:session` with Node 22+ and Chrome installed. Set `CHROME_PATH` when Chrome is elsewhere. To record dated evidence, use `node scripts/session-smoke.mjs --evidence=YYYY-MM-DD`. The browser script uses a disposable profile and local Vite server; it never touches an existing browser profile.
