---
id: c0092
title: Docs — inbox as a status
status: review
epic: e07
depends: [c0088]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T17:58:03
---

## What

Update the docs to the inbox-as-status model.

- concept.md §4: inbox is a status/column, not a folder; a card's location is
  its epic assignment (`cards/` or `epics/eNN/`); the three homes become two
  (`cards/`, `epics/eNN/`).
- CLAUDE.md: capture = card in `cards/` with `status: inbox`; "move back to
  inbox" = set status; query recipes updated (no `inbox/` folder); triage
  wording reworked.

## Acceptance criteria

- [x] concept.md §4 describes inbox as a status and location = assignment; no
      `inbox/` folder in the layout
- [x] CLAUDE.md board conventions + query recipes updated for the new model
- [x] No stray references to the `inbox/` folder in docs
- [x] Examples match the shipped schema (c0088)

## Log

- 2026-07-18 created from the e07 inbox reframe (c0087)
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): part of the e07 inbox-as-status reframe, landed as one coherent pass; full suite (500) + Rust (41) + typecheck + lint green.
