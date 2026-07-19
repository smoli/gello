---
id: c0095
title: Session store — UUID per card/epic
status: backlog
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-19
---

## What

Persist the mapping from a card (or its epic) to its agent **session UUID**,
so a run resumes prior context instead of starting cold. Scope is
**configurable: per card (default) or per epic**.

- Store the card/epic → session-UUID map durably (under `.gello/.companion/`
  or app-local — decide here; leans `.gello/.companion/` so it travels with
  the board but stays out of the card files).
- On dispatch, look up an existing session for the card (or its epic, per
  config) and resume; else start a new one and record its UUID.

## Acceptance criteria

- [ ] Card/epic → session-UUID mapping is persisted and survives restarts
- [ ] Per-project config selects the scope: per-card (default) or per-epic
- [ ] Dispatch resumes an existing session when one is recorded, else starts
      fresh and stores the new UUID
- [ ] Per-epic scope shares one session across the epic's child cards
- [ ] A stale/invalid UUID (agent lost the session) falls back to a fresh
      start without failing the run

## Log

- 2026-07-19 created from the e08 companion breakdown
