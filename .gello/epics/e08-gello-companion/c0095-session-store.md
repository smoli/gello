---
id: c0095
title: Session store — UUID per card/epic
status: done
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T14:59:32
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

- [x] Card/epic → session-UUID mapping is persisted (`.companion/sessions.json`)
      and survives restarts (atomic write, load-on-start)
- [x] Scope is selectable: per-card (default) or per-epic — `sessionKey` /
      `resolveSession` honour a `SessionScope`; the config *source* is wired in
      c0099, the store already respects the value
- [x] `resolveSession` returns the recorded id to resume, or null to start
      fresh; `recordSession` stores a new id
- [x] Per-epic scope shares one session across the epic's cards (tested)
- [~] Stale/invalid UUID → fresh start: the store supports overwriting a key,
      but *detecting* a dead session happens at resume time — deferred to the
      dispatch flow (c0097), which re-records a fresh id on a failed resume

## Notes

- `companion/sessions.ts` (tested, 8 tests): `sessionKey(card, scope)`
  (`epic:<id>` in epic scope with an epic, else `card:<id>`), file-backed
  `SessionMap` under `.companion/sessions.json` (reuses the atomic
  `writeJsonAtomic` / `readJson` extracted into `core.ts`), and pure
  `resolveSession` / `recordSession`.
- Corrupt/missing store loads as `{}` rather than throwing.
- 523 tests green, typecheck + lint clean.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)
- 2026-07-19 in-progress → implemented TDD (agent): sessions.ts (scope keys,
  file-backed map, resolve/record), atomic-JSON helpers factored into core;
  stale-UUID fallback deferred to c0097. 523 green; status → review
- 2026-07-19 status → ready (app)
- 2026-07-19 status → done (app)
