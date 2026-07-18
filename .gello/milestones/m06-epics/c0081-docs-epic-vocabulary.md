---
id: c0081
title: Docs — epic vocabulary in concept.md + CLAUDE.md
status: ready
priority: normal
milestone: m06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T06:09:20
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

- [ ] concept.md §4 describes epics, standalone `cards/`, and tags-as-axis
- [ ] CLAUDE.md board section uses epic vocabulary and updated query recipes
- [ ] No stray "milestone" in docs except an intentional migration note
- [ ] The card/epic format examples match the shipped schema (c0076)

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
