# CrazyGames portal adapter, 2026-10-16

Scope: portal-neutral SDK adapter (`src/portal/`), CrazyGames SDK v3 adapter, `--mode crazygames` build, stubbed-SDK unit and browser checks, submission pack in `docs/portals/crazygames.md`. No submission, account, deploy or `rokumon-games` change. Existing test files untouched.

Decisions: build flag (Vite mode) selects the portal; no SDK means no-ops. Midgame ad requested when the result dialog opens. `inert` does not reach an open modal dialog, so a capture-phase input guard blocks input during ads. No local ad-frequency timer.

Verified: 90 unit tests, hub smoke, session smoke, CrazyGames smoke (stub ad path, ad-blocker play, 1.36 MiB initial download, 3 files).

Open: cover art and preview video, physical-device touch checks, Edge/Safari runs, SDK Data module for Full Launch, self-hosted fonts.
