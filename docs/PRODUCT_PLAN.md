# Product plan — Rokumon Sudoku

## Product thesis

Most Sudoku products are utilities: pick a difficulty, complete a grid, repeat. Rokumon Sudoku should feel like a compact adventure whose terrain is logic. Every completed board advances one of three motivations: **mastery** (better solving), **collection** (themes, seals, titles) and **journey** (campaign gates).

## Core loop

1. Select a campaign node or quick-create a trial.
2. Scan clues, place digits, maintain candidates and correct mistakes.
3. Complete the grid and receive a score shaped by difficulty, speed and assistance.
4. Unlock the next campaign node and progress toward a player rank.
5. Return for a daily seed, a streak, a harder gate or a different variant.

## Modes

| Mode | Session | Pressure | Reward purpose |
| --- | --- | --- | --- |
| Campaign | 5–20 min | Progressive difficulty | Unlock gates, titles and cosmetics |
| Quick Play | 3–25 min | Player-selected | Practice, points and personal bests |
| Daily Trial | 5–15 min | One fixed daily seed | Streak and comparable score |
| Zen | Open-ended | No score or mistake count | Calm practice |
| Five-Minute Sprint | ≤5 min | Countdown | Fast score chase |

## Variant strategy

The vertical slice ships four selectable board experiences:

- **Classic 9×9** — standard rows, columns and 3×3 boxes.
- **Crosswind** — Classic plus both long diagonals.
- **Pocket 6×6** — shorter sessions with 2×3 regions.
- **Chromatic** — Classic constraints with a colour identity per digit; digits remain visible for accessibility.

The engine models constraints as groups of cells, so later variants can be added without rewriting the UI. Recommended next additions are Killer cages, Jigsaw regions, Windoku, Even/Odd and Samurai layouts. Killer and Jigsaw require dedicated generation and uniqueness validation rather than cosmetic rules.

## Campaign — The Six Gates

Twelve trials are grouped into six gates. Early gates teach interaction on 6×6 and forgiving 9×9 boards. Middle gates introduce Chromatic and diagonal constraints. Final gates combine sparse clues with the hardest variants.

- Gate I — orientation and confident singles.
- Gate II — scanning and pairs.
- Gate III — diagonal constraint literacy.
- Gate IV — sparse boards and candidate discipline.
- Gate V — long deduction chains.
- Gate VI — mastery trials and the Keeper of Nine title.

Production campaign content should use hand-reviewed seeds, technique tagging and a no-guessing solve log. Generated boards are acceptable for Quick Play; campaign boards need authored pacing.

## Progression and economy

- Award a base reward per challenge, plus a bounded speed bonus.
- Deduct reward value for mistakes and hints; never deduct banked player points.
- Ranks: Initiate, Wayfinder, Adept, Cipher Sage, Keeper of Nine.
- Completion unlocks the next campaign trial. Points should later unlock cosmetic board materials, number sets, seal frames and trails.
- Do not sell hints as consumable power in the first release. Monetisation should not compromise puzzle integrity.

## Visual direction

The board is treated as a crafted object on warm paper, framed by ink rules and a single vermilion seal accent. Bricolage Grotesque carries the game voice; IBM Plex Sans carries readable UI; Space Mono handles time and score. Parchment, Midnight, Sakura and Moss themes swap semantic tokens rather than duplicating components.

Motion is reserved for three meanings: press feedback, incorrect-placement correction and puzzle completion. Reduced-motion removes spatial effects. Phaser renders quiet background geometry and a short completion burst; all text-heavy controls stay in accessible DOM.

## Mobile and accessibility

- Mobile-first layout at 320, 375, 414 and 768 CSS pixels.
- Safe-area padding and dynamic viewport units.
- Touch, mouse and keyboard parity.
- Visible focus states, semantic buttons, live placement feedback and descriptive cell labels.
- Digits always accompany colour; difficulty is not communicated by colour alone.
- Next accessibility pass: screen-reader grid navigation mode, high-contrast theme and user-selectable large-board zoom.

## Technical architecture

- **Simulation:** pure TypeScript constraint engine and serialisable session state.
- **Renderer:** DOM board and controls; Phaser owns only ambient graphics and completion effects.
- **Persistence:** versioned local storage for points, campaign unlocks, streak and theme.
- **Generation:** seeded solved-grid generation, clue carving and two-solution cutoff for uniqueness.
- **Distribution:** Vite relative-path build, responsive embed, Rokumon Games Event API v1.
- **Testing:** generator validity/uniqueness tests, score tests, production build, viewport screenshots and a manual playtest checklist.

## Rokumon integration

Events emitted by the vertical slice:

- `hub:ready` when the game is actionable.
- `hub:score` when lifetime points change.
- `hub:gameover` with earned reward and solve duration.
- `puzzle-completed` with mode, variant, difficulty, reward and seconds.

Later events: `gate-cleared`, `daily-streak`, `rank-earned`, `no-hint-clear`, `perfect-sprint`.

## Delivery roadmap

### Phase 0 — Vertical slice (implemented)

- Valid puzzle generation and uniqueness checks.
- Core solve loop, notes, hint, erase and undo.
- Campaign trail, quick create, Daily, Zen and Sprint.
- Local progression, scoring, themes and hub events.
- Responsive visual system and automated engine tests.

### Phase 1 — Content alpha

- Replace generated campaign boards with 36 hand-reviewed puzzles across six gates.
- Add tutorial overlays based on actual techniques.
- Add pause/resume for active sessions and personal-best records.
- Add high-contrast and large-board accessibility settings.
- Instrument completion, abandonment, assistance and difficulty-step events.

### Phase 2 — Variant expansion

- Add Killer, Jigsaw and Even/Odd with generator-specific uniqueness tests.
- Add a daily calendar and shareable non-spoiler result card.
- Add unlockable board materials and seal frames.
- Add offline/PWA packaging if Rokumon hosting supports service workers.

### Phase 3 — Release candidate

- Content QA across all campaign seeds.
- Device pass on current Safari iOS, Chrome Android, Chrome/Edge/Firefox desktop.
- Performance budget: fast first interaction, stable board layout and no runtime asset stalls.
- Privacy, analytics and age-rating review.
- Final title/trademark clearance and store metadata.

## Success measures

Do not invent targets before a baseline exists. Capture these measures during alpha:

- Puzzle start → completion rate by mode and difficulty.
- Median solve time and hint/mistake distribution.
- Campaign step abandonment.
- Day-1 and Day-7 return rate.
- Daily Trial participation and streak continuation.
- Theme and variant usage.

## Principal risks

- **Difficulty credibility:** clue count alone is not a technique-based rating. Mitigation: solver-derived technique grading before campaign content lock.
- **Generated variant quality:** uniqueness does not guarantee an elegant solve. Mitigation: curate campaign seeds and retain generation for Quick Play.
- **Mobile density:** 9×9 targets are physically small at 320 px. Mitigation: board zoom/focus mode in Phase 1 and generous keypad controls now.
- **Name collision:** “Ultimate Sudoku” is heavily used. Mitigation: ship only under a distinctive Rokumon-led provisional identity until formal clearance.

## Release definition

The game is ready for Rokumon Games when every campaign puzzle is logically graded and no-guessing, active games resume safely, the full mobile/device matrix passes, hub events match the host manifest, accessibility blockers are closed, and the public name has been cleared.
