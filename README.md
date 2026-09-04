# Rokumon Sudoku

A campaign-led Sudoku game for Rokumon Games. The playable vertical slice includes four board experiences, five modes, scoring, persistent progression, themes, notes, hints, undo, keyboard input, touch-first controls, and Rokumon Games Event API v1 messages.

**Rokumon Sudoku** is the selected public working title. “Ultimate Sudoku” was rejected as too crowded; see `docs/NAME_RESEARCH.md`.

## Run locally

```powershell
npm install
npm run dev
```

## Verify

```powershell
npm run verify
```

## Controls

- Click or tap a cell, then choose a number.
- Keyboard: `1–9`, arrow keys, `N` for notes, `H` for hint, `Backspace` to erase, `Ctrl/Cmd+Z` to undo.

## Project map

- `src/game/` — deterministic generation, constraints, scoring, campaign data and progression.
- `src/ui/` — responsive DOM game interface.
- `src/main.ts` — Phaser ambience and application boot.
- `tokens.css` — portable visual tokens and board themes.
- `docs/PRODUCT_PLAN.md` — comprehensive product and delivery plan.
- `tests/` — generator and scoring verification.

## Rokumon Games listing art

- Shipping catalogue cover: `assets/listing/cover.jpg` (1536×1024, 3:2)
- Shipping detail hero: `assets/listing/hero.jpg` (1600×900, 16:9)
- Lossless source masters: matching PNG files in `assets/listing/`
- Generation provenance and prompts: `assets/CREDITS.md`
- Hub intake draft: `game-hub-manifest.json`
