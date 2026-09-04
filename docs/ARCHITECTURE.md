# Architecture

## Boundaries

- `src/game/sudoku.ts` owns constraints, generation, solution validation and scoring.
- `src/game/presets.ts` owns variants, modes and campaign nodes.
- `src/game/store.ts` owns versioned local player progression.
- `src/ui/app.ts` maps state to accessible DOM and input to named actions.
- `src/main.ts` boots the DOM app and a disposable Phaser ambience scene.
- `src/integrations/hub.js` is the only boundary to the Rokumon host.

The renderer never owns puzzle truth. Generated solutions and player entries are plain arrays that can later be saved to a backend or replay log.

## Generator

Variants compile to constraint groups: rows, columns, regions and optional diagonals. A seeded minimum-remaining-values backtracker creates a solved board. Clues are removed one at a time and retained only while a two-solution cutoff confirms uniqueness.

## Save boundary

The vertical slice persists durable player progression only. Active-session resume is planned for Phase 1 and should serialise the seed, mode, entries, notes, elapsed time and assistance counts—not DOM or Phaser objects.
