# Architecture

## Boundaries

- `src/game/sudoku.ts` owns constraints, generation, solution validation and scoring.
- `src/game/presets.ts` owns variants, modes and campaign nodes.
- `src/game/store.ts` owns versioned local player progression.
- `src/game/session.ts` owns the plain active-puzzle state and initial state creation.
- `src/game/sessionStore.ts` owns checkpoint serialisation, deterministic regeneration and restoration validation.
- `src/ui/app.ts` maps state to accessible DOM and input to named actions.
- `src/main.ts` boots the DOM app and a disposable Phaser ambience scene.
- `src/integrations/hub.js` is the only boundary to the Rokumon host.

The renderer never owns puzzle truth. Generated solutions and player entries are plain arrays that can later be saved to a backend or replay log.

## Generator

Variants compile to constraint groups: rows, columns, regions and optional diagonals. A seeded minimum-remaining-values backtracker creates a solved board. Clues are removed one at a time and retained only while a two-solution cutoff confirms uniqueness.

## Save boundary

The active checkpoint serialises puzzle identity, clues, entries, notes, undo history, selection, tools, elapsed time, assistance counts and terminal state alongside progression in one storage write. It regenerates puzzle truth before restoring the saved board. The original flat progression key remains a compatibility mirror. See `docs/SAVE_AND_STATE.md` for timer semantics, corruption recovery and write-failure behaviour.
