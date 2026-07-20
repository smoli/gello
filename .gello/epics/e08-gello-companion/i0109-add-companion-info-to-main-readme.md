---
id: i0109
title: add companion info to main readme
status: done
type: issue
ref: c0099
epic: e08
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:41:07
---

with link to the companions readme

## Notes

- Added a **Companion (agent runner)** section to the main `README.md`, between
  "For agents" and "Development". It summarises what the companion does (watches
  the board, runs an agent on `ready`, headless, card-based Q&A, state file) and
  links to [companion/README.md](../../../companion/README.md) for install,
  config, and the resume protocol.
- Docs-only change, so no test — TDD covers parsing/board logic, not prose.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 status → review (agent)
- 2026-07-20 status → done (app)
