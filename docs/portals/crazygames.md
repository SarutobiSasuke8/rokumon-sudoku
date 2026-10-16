# CrazyGames submission pack: Rokumon Sudoku

Status: build and SDK adapter ready for a Basic Launch submission; cover art and preview video still to produce. Nothing has been submitted, and no CrazyGames account was created from this repo. Requirements checked against docs.crazygames.com on 2026-10-16 (requirements/technical, requirements/gameplay, requirements/ads, requirements/game-covers, sdk/intro, sdk/game, sdk/video-ads).

## Build

```powershell
npm ci
npm run build:crazygames    # tsc + vite build --mode crazygames -> dist-crazygames/
npm run smoke:crazygames    # stubbed-SDK ad path, ad-blocker play, size limits
```

`--mode crazygames` differs from the default build in three ways, all in `vite.config.ts`:

- injects `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>` before the game bundle;
- removes `<script src="/hub-bridge.js">` (an absolute path the portal does not serve; the Rokumon hub build keeps it);
- adds `user-select: none` (with `-webkit-`, `-moz-`, `-ms-` prefixes) on `body`.

`npm run build` (itch.io and the Rokumon hub) is unchanged, and with no SDK on the page every portal call is a no-op.

## Zip layout

Zip the contents of `dist-crazygames/`, not the folder itself, so `index.html` is at the zip root:

```text
index.html
assets/index-<hash>.js
assets/index-<hash>.css
```

All paths are relative (`./assets/...`). On Windows, `Compress-Archive` in PowerShell 5.1 writes backslash entry names, so use the built-in `tar` instead:

```powershell
cd dist-crazygames
tar.exe -a -c -f ..\rokumon-sudoku-crazygames.zip index.html assets
```

## Measured build (2026-10-16, commit on branch `claude/crazygames-sdk-20261016`)

| Measure | Value | Limit |
|---|---|---|
| Initial download, load start to first `gameplayStart` (same-origin bytes from the Resource Timing API) | 1,426,822 B (1.36 MiB) | 50 MB; 20 MB for mobile homepage |
| Total bundle | 1,426,822 B (1.36 MiB) | 250 MB |
| Files | 3 | 1,500 |
| Zip (tar, deflate) | 370,156 B | n/a |
| Time to `gameplayStart`, localhost, headless Chromium | 528 ms | 20 s |

The initial-download figure excludes the CrazyGames SDK script (served by CrazyGames) and the Google Fonts stylesheet (see the checklist). The smoke check fails CI if the initial download passes 20 MB or the bundle passes 250 MB or 1,500 files. Evidence: `tests/evidence/2026-10-16-crazygames-smoke.json`.

## SDK integration

Code: `src/portal/index.ts` (portal-neutral interface) and `src/portal/crazygames.ts` (SDK v3 adapter).

| Event | When it fires |
|---|---|
| `init` | Before the app mounts. A 5 s guard stops a stalled init from blocking the game. |
| `loadingStart` / `loadingStop` | Around the app mount. |
| `gameplayStart` | When a puzzle board is playable with no dialog open. The game opens straight onto a board, so this is first-screen play with no menu click. Reported after `loadingStop`. |
| `gameplayStop` | Puzzle solved, Sprint timer expired, or a dialog (Quick create, themes, result) opens. |
| `requestAd("midgame")` | When the result dialog opens after a solve or Sprint expiry: a natural break between puzzles. No local frequency timer; CrazyGames enforces about one midgame ad per 3 minutes and returns `adCooldown` otherwise. |
| `requestAd("rewarded")` | Exposed as `portal.requestRewardedAd()`; not used by any UI yet. Only a `"finished"` result may grant a reward. |

Ad-break behaviour:

- Ad requested: the game loop and timer pause, `#app` becomes `inert`, and a capture-phase guard swallows clicks, key presses, form submits and Escape (needed because `inert` does not reach an open modal dialog).
- `adStarted`: Phaser sound is muted. Muting never happens on the request alone.
- `adFinished` and `adError`: unmute (only if muted), then resume. Late or duplicate callbacks are ignored. A second request while one is open returns `"unavailable"` without stacking.
- SDK blocked, missing, init failed, or environment `disabled`: the portal is inactive, every call is a no-op and ad requests resolve `"unavailable"` without pausing.

A GameDistribution adapter would implement the same `PortalAdapter` (`SDK_GAME_PAUSE` maps to `started`, `SDK_GAME_START` to `finished`) and add one line to `selectAdapter`; the game loop does not change. It is not built.

**Basic Launch has ads switched off** (`adError` with `adsDisabledBasicLaunch`), so the stubbed-SDK tests are the only proof of the ad path until Full Launch: `tests/portal.test.ts` (unit) and `scripts/crazygames-smoke.mjs` (browser, both run in CI).

## QA checklist

Pass = verified in this branch. Fail = known gap. Not verified = needs a human or device check.

| # | Requirement (source) | Status | Evidence or note |
|---|---|---|---|
| 1 | Initial download 50 MB or less (technical) | Pass | 1.36 MiB measured to first `gameplayStart` |
| 2 | Initial download 20 MB or less for mobile homepage eligibility (technical) | Pass | 1.36 MiB |
| 3 | Total size 250 MB or less (technical) | Pass | 1.36 MiB |
| 4 | 1,500 files or fewer (technical) | Pass | 3 files |
| 5 | Relative paths only (technical) | Pass | Hub bridge stripped; smoke asserts no `src="/` or `href="/` in HTML, CSS, JS |
| 6 | Time to gameplay 20 s or less (technical) | Pass (local only) | 528 ms on localhost; not measured over a real network |
| 7 | No external links (gameplay) | Pass | No `<a>`, `href`, `window.open` or location changes in `src/` |
| 8 | No cross-promotion, no app-store links (gameplay) | Pass | None in the game; smoke asserts no App Store or Play links in the bundle |
| 9 | No custom fullscreen button (gameplay) | Pass | None; no `requestFullscreen` calls |
| 10 | `user-select: none` on `body`, with prefixes (technical) | Pass | Injected by the crazygames build; smoke asserts it |
| 11 | iOS AudioContext resumed inside `touchend` or `click` (technical) | N/A | The game plays no audio. If sound is added, resume the context in a `touchend` or `click` handler, not only on `visibilitychange` |
| 12 | Sitelock whitelists every `*.crazygames.com` origin plus app origins (technical) | N/A | No sitelock exists |
| 13 | Touch support if mobile is claimed (technical) | Not verified | Touch controls exist and pass an emulated 375x812 touch run (`npm run smoke:session`); no physical iOS Safari or Chrome Android check yet (open in `TODO.md`) |
| 14 | Chrome works (technical) | Pass | Playwright Chromium in CI, Chrome locally |
| 15 | Edge works (technical) | Not verified | Chromium-based, but not run separately |
| 16 | Safari and 4 GB Chromebook run smoothly (technical) | Not verified | Disabled per-browser by CrazyGames if poor |
| 17 | Mouse and keyboard support (technical) | Pass | Keyboard `1-9`, arrows, `N`, `H`, Backspace, Ctrl/Cmd+Z; mouse and tap on cells and pad |
| 18 | English localisation (gameplay) | Pass | English only; SDK `locale` not read (falls back to English) |
| 19 | New users drop straight into gameplay, one click maximum (gameplay) | Pass | First screen is a playable board |
| 20 | Only SDK ads, no other ad SDKs (ads) | Pass | None |
| 21 | Pause and block input on ad request; mute only on start; resume on finish and error (ads) | Pass (stub) | Unit and browser smoke with the SDK stubbed |
| 22 | Playable with an ad blocker (ads) | Pass | Smoke run with the SDK script blocked completes and replays a puzzle |
| 23 | Midgame ads only at logical breaks, never during play or on menu buttons (ads) | Pass | Only when the result dialog opens |
| 24 | `gameplayStart` and `gameplayStop` around play (sdk/game; Full Launch) | Pass | Order asserted in smoke |
| 25 | Data module for progress saving, where applicable (Full Launch) | Fail | Progress is in `localStorage` only; move saves to `SDK.data` before Full Launch |
| 26 | External resources | Warn | `src/style.css` imports Google Fonts from `fonts.googleapis.com`; the game falls back to system fonts if blocked. Self-hosting the fonts would remove the only non-SDK external request |
| 27 | Cover images: landscape 1920x1080, portrait 800x1200, square 800x800 (game-covers) | Fail | Existing art is `assets/listing/cover.*` 1536x1024 and `hero.*` 1600x900 / 1672x941; none of the three required sizes exist |
| 28 | Preview video: 15-20 s, landscape 1080p 16:9 and portrait 1080p 2:3, no sound, 50 MB max, starts on the static cover (game-covers) | Fail | Not produced |
| 29 | Title clearance | Not verified | `TODO.md` lists formal title/trademark clearance as open |

Still failing or unverified before submission: 13, 15, 16 (device checks); 25 (Data module, Full Launch only); 27 and 28 (covers and video); 29 (title); 26 is a warning.

## Proposed store copy

**Title:** Rokumon Sudoku

**Short description:** Sudoku with a path. Clear six campaign gates, then make your own puzzles.

**Description:**

Rokumon Sudoku is a calm, campaign-led Sudoku game. Walk the Six Gates, from a brisk Pocket 6x6 board to Classic 9x9, Chromatic and Crosswind, where both long diagonals must also hold 1 to 9. Every puzzle has one valid solution. Earn points for clean, quick solves, climb the ranks, keep a daily streak going, and pick a board theme that suits you. Want something different? Quick create builds a new puzzle in your chosen mode, board and difficulty, including a five-minute Sprint and a relaxed Zen mode. Your progress saves as you play.

**Controls:**

- Mouse or touch: tap a cell, then tap a number. Notes, Undo, Erase and Hint are under the number pad.
- Keyboard: `1-9` to place a digit, arrow keys to move, `N` for notes, `H` for a hint, `Backspace` to erase, `Ctrl+Z` to undo.

**Genre and tags:** Puzzle; sudoku, logic, number, brain, casual, daily.

**Orientation:** both (responsive layout down to 320 CSS px). Declare mobile only after check 13 passes.

## Art and media to produce

| Asset | Size | Notes |
|---|---|---|
| Landscape cover | 1920x1080 (16:9) | Can be re-cut from the `hero.png` master (1672x941) only with upscaling; a fresh render is better |
| Portrait cover | 800x1200 (2:3) | New crop or render |
| Square cover | 800x800 (1:1) | New crop or render |
| Landscape video | 1080p, 16:9, 15-20 s | No sound, no fast-forward, first frame is the static cover; no black bars, default cursor, "Play Now" text or app or social icons |
| Portrait video | 1080p, 2:3, 15-20 s | Same rules |

The CrazyGames requirement pages read for this pack ask for covers and preview videos but no separate screenshot set. The existing listing art was made with OpenAI image generation (`assets/CREDITS.md`).

## Out of scope here

No CrazyGames account, no submission, no payment onboarding, no changes to `rokumon-games` or deploy config. Alexei submits.
