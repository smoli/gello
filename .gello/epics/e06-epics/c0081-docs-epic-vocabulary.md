---
id: c0081
title: Docs — epic vocabulary in concept.md + CLAUDE.md
status: done
epic: e06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T11:19:49
---

## What

Update the docs to the epic model.

- concept.md §4: epic replaces milestone; document the three homes
  (`inbox/`, `epics/eNN-name/`, `cards/`), epic-less standalone cards, and
  tags as the separate cross-cutting axis.
- CLAUDE.md: board conventions (triage = move to an epic or to `cards/`;
  query recipes updated for the new folders); vocabulary swept from
  "milestone" to "epic".

## Acceptance criteria

- [x] concept.md §4 describes epics, standalone `cards/`, and tags-as-axis
- [x] CLAUDE.md board section uses epic vocabulary and updated query recipes
- [x] No stray "milestone" in docs except an intentional migration note
- [x] The card/epic format examples match the shipped schema (c0076)

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): concept.md §4 — three homes (inbox/,
  epics/eNN-name/, cards/), epic-less standalone cards, tags-as-axis; card
  example uses `epic: e02`, epic-format block renamed with `id: eNN`; two
  intentional milestone mentions kept (the rename note + migration note).
  CLAUDE.md board section + query recipes swept to epics/+cards/. Also updated
  the *shipped* convention (scaffold.ts): a fresh board now scaffolds epics/ +
  cards/ (not milestones/) and ships epic vocabulary — with tests. Follow-up:
  gello-discuss/onboard skills still say "milestone" (leave to c0082).
- 2026-07-18 status → done (app)
