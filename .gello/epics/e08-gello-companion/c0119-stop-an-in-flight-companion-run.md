---
id: c0119
title: Stop an in-flight companion run
status: discuss
epic: e08
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T07:05:00
---

## What

Once the companion has dispatched an agent, there is no way to stop **that one
run**. Moving the card back out of `ready`/`in-progress` does not recall the
agent — it keeps working, keeps writing files, and keeps spending tokens. The
only lever today is killing the companion process, which stops **every** run
including ones you wanted.

This surfaced concretely on 2026-07-22: c0116 was dragged to `ready` by
accident, an agent was dispatched, and moving the card straight back to
`discuss` changed nothing — the agent carried on and had to be killed at the
process level.

[[c0117]] adds a grace period before pickup, which covers noticing within
seconds. This card covers the rest: noticing *after* the run has started.

## Open questions (pre-discuss)

- **Trigger** — automatic (moving a card out of the running status recalls its
  agent, so card position is the single source of truth), an explicit "stop"
  control, or both? Automatic is elegant but infers intent from a drag.
- **Partial work** — a stopped agent may leave half-finished edits and an
  uncommitted tree. Leave them exactly as they are (the same recoverable state
  as the existing crash/error path), or attempt any cleanup?
- **Card status** — the agent stamped `in-progress` on pickup. After an abort,
  does the card revert to where it was, stay `in-progress`, or land somewhere
  explicit?
- **The session** — the agent's session id persists in `sessions.json`. Keep it
  (so the card can be resumed later with its context) or discard it?
- **Surfaces** — the app (the c0100 runs popover is the obvious home), the TUI
  (c0112 deliberately deferred control keys), and/or the CLI.
- **Scope creep check** — is "stop" enough, or is "pause/resume" wanted too?

## Log

- 2026-07-22 split out of the [[c0117]] discussion, which deliberately scoped
  itself to the pre-dispatch grace period and left aborting a live run here.
