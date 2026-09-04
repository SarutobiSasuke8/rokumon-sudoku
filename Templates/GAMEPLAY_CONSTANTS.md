# Gameplay Constants

Keep all player-facing tuning in named groups. Tune through a human playtest, not by intuition alone.

## Puzzle interaction

| Constant | Value | Why | Verified in |
|---|---:|---|---|
| Mistake penalty | 40 points | Makes errors visible without ending a run | Browser playtest 2026-09-04 |
| Hint penalty | 60 points | Keeps assistance useful but score-relevant | Browser playtest 2026-09-04 |
| Note penalty | 0 points | Notes are a normal solving tool | Browser playtest 2026-09-04 |

## Difficulty and Progression

| Constant | Value | Why | Verified in |
|---|---:|---|---|
| Starting difficulty | Easy | Gives new players a legible first gate | Browser playtest 2026-09-04 |
| Campaign ramp | 12 nodes across 6 gates | Introduces harder difficulties and variants progressively | Browser playtest 2026-09-04 |
| Target session length | 3–15 minutes | Supports quick mobile play and deeper expert sessions | To validate externally |

## Feel and Accessibility

| Constant | Value | Why | Verified in |
|---|---:|---|---|
| Input buffer | One discrete action | Prevents accidental repeated digit entry | Browser playtest 2026-09-04 |
| Celebration motion | Ambient burst; disabled by reduced-motion query | Keeps success expressive without blocking | Browser playtest 2026-09-04 |
| Audio default | No audio in vertical slice | Avoids unrequested autoplay and unlicensed assets | Product decision 2026-09-04 |
