---
id: c0099
title: Config & docs / packaging
status: in-progress
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-20
status-changed: 2026-07-20T09:30:00
---

## What

Per-project companion configuration, docs, and an install/run path.

- **Config** (per project): agent backend (Claude / pi), session scope
  (per-card / per-epic), trigger, and any run limits. Where it lives — leans
  `.gello/` (travels with the board) since it's board-level workflow, but
  confirm vs app-local.
- **Docs / README**: how to install and run `gello-companion`, the state-file
  contract, the card Q&A convention.
- **Packaging**: a runnable CLI (npm bin / standalone); the desktop app's
  "start companion" toggle (a one-click child-process launch) can wire to it.

## Acceptance criteria

- [ ] Per-project config selects backend, session scope, and trigger; sane
      defaults when absent
- [ ] README documents install, run, config, the state-file shape, and the
      card Q&A convention
- [ ] The CLI is installable/runnable standalone (headless)
- [ ] The app-launch bridge (one-click "start companion") is documented (its
      implementation may be a small app-side follow-up)

## Notes

**Config location — decided `.gello/companion.yaml` (committed), env overrides.**
The card left this open ("confirm vs app-local"). Board-level workflow
(session scope, trigger, run limits) belongs with the board and should travel
with it, matching the e08 principle that app and companion coordinate only
through `.gello/` files. The one per-machine concern — which agent CLI is
installed (claude vs pi) and its permission mode — is handled by env-var
overrides that beat the file, so a teammate without `pi` can override without
editing committed config. Runtime state stays app-local under
`.gello/.companion/` (gitignored), unchanged. Rejected app-local-only config:
it would hide the workflow choice from the board and from anyone reading the
repo. If the human prefers app-local, the switch is a one-line path change.

**Precedence:** env var > `companion.yaml` > built-in default. Absent file →
all defaults (criterion: sane defaults when absent). Malformed file → fail
fast at startup with the path (don't silently revert to defaults and run the
wrong backend).

**Trigger** is wired, not just stored: `trigger` (default `ready`) is the
status whose entry dispatches a run — threaded through `cardsEnteringReady`
and `planDispatch`.

**Packaging:** a `bin` (`gello-companion`) + shebang makes the CLI
installable/linkable; it already runs headless. README documents the
standalone `npx tsx companion/main.ts [dir]` path as the portable fallback.

**App-launch bridge:** documented only (per the card, its implementation is a
small app-side follow-up — c0100 territory).

**Out of scope:** runner.ts comments reference "the companion system prompt
(c0099)"; the convention is already taught inline in `buildTaskPrompt`. A
dedicated prompt file is a possible follow-up, not required by the criteria.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress; config→`.gello/companion.yaml` + env
  overrides; wiring trigger; expanding README; adding `bin` packaging.
