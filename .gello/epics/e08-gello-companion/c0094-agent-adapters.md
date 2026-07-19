---
id: c0094
title: Agent adapters — Claude & pi
status: in-progress
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T10:22:00
---

## What

A small adapter interface abstracting an agent backend, with **Claude CLI**
and **pi CLI** implementations. The rest of the companion talks to agents
only through this interface.

The interface covers:

- **start** a new session for a task (returns a session id/UUID).
- **resume** an existing session by its stored UUID with new input.
- build the **launch invocation** (headless run vs. interactive terminal
  command — the latter used by the c0098 fallback).

## Acceptance criteria

- [ ] An `AgentAdapter` interface: start(task) → session id, resume(id,
      input), and a launch-command builder
- [ ] A **Claude CLI** adapter implementing it (verify current flags for
      resumable sessions + non-interactive run)
- [ ] A **pi CLI** adapter implementing it (pi persists sessions by UUID —
      wire resume)
- [ ] Backend is selectable per project (config lands in c0099)
- [ ] Adapter errors (missing CLI, bad session) surface cleanly, don't crash
      the companion

## Notes

The exact resume/interactive flags for Claude and pi must be checked against
the installed CLIs when this is built — keep the interface thin until then.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)
