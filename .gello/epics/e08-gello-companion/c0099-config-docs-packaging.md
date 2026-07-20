---
id: c0099
title: Config & docs / packaging
status: ready
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-20
status-changed: 2026-07-20T08:19:09
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

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-20 status → ready (app)
