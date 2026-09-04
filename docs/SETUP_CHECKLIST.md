# Setup Checklist

Use this after creating a new repository from this template.

## Required

- [x] Replace project identity fields in `AGENTS.md`.
- [x] Fill in `docs/PROJECT_BRIEF.md`.
- [x] Replace command placeholders in `AGENTS.md`.
- [ ] Review `docs/PERSONA_COUNCIL.md` and decide how much of the persona council to keep active.
- [x] Choose package manager and stack conventions.
- [x] Choose a runnable profile in `profiles/` or document why the project does not use one.
- [x] Set the orientation, input targets, performance budget, and distribution target in `docs/PROJECT_BRIEF.md`.
- [x] Populate `Templates/INPUT_CONTROL_MAP.md`, `Templates/GAMEPLAY_CONSTANTS.md`, and `Templates/ASSET_MANIFEST.json`.
- [x] Update `README.md` with the actual project name and usage.
- [ ] Review persona files and decide whether to keep private frontmatter.
- [ ] Decide which personas are active for this project and whether to use the full council protocol.
- [ ] Decide whether session log `owner` should be personal, team, or blank.
- [x] Create the first session log when the initial project setup is complete.
- [x] Run `./scripts/check-agent-docs.ps1 -Strict`.
- [ ] Make the first commit.

## Recommended

- [x] Add real install, run, test, lint, and build commands.
- [ ] Add `.env.example` values for required configuration.
- [x] Add first test or smoke-check command.
- [x] Run the deterministic smoke path and create a first playtest report from it.
- [x] Decide whether the `games-hub`, `mobile-first`, or `agentic-operations` addon belongs in this project.
- [x] Add deployment target notes.
- [x] Replace `TODO.md` starter tasks with the actual working queue.
- [x] Replace `ROADMAP.md` starter direction with real milestones.

## Optional

- [ ] Add project-specific Cursor rules only when needed.
- [ ] Add project-specific Copilot notes only when needed.
- [ ] Add GitHub secrets/environment documentation.
- [ ] Add screenshots or design references.
- [ ] Replace the sample session log with the first real project session log.
