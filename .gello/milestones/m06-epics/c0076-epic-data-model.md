---
id: c0076
title: Epic data model — rename milestone→epic in schema + loader
status: ready
milestone: m06
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T06:09:08
---

## What

The foundation for the epic model (root of m06). Rename the milestone concept
to epic in the data layer, and support epic-less standalone cards.

- Field `milestone:` → `epic:`; type `Milestone` → `Epic`; container
  `milestone.md` → `epic.md`; folder/id namespace `mNN` → `eNN`.
- Loader groups cards by epic folder exactly as it grouped by milestone
  (behaviour identical, names changed).
- New home: standalone cards load from a flat `.gello/cards/` (no `epic:`,
  no epic membership), alongside `inbox/` and `epics/eNN-name/`.
- Folder location is the source of truth for epic membership (epic folder =
  belongs; `cards/` = standalone).

## Acceptance criteria

- [ ] `epic:` parses where `milestone:` did; `epic.md` parses where
      `milestone.md` did; `Epic` type replaces `Milestone`
- [ ] Loader reads three homes: `inbox/`, `epics/eNN-name/` (epic-grouped),
      and `.gello/cards/` (standalone, no epic)
- [ ] `e`-namespace id allocation for epics; standalone cards keep the
      c-namespace
- [ ] Grouping/ordering behaviour is unchanged from the milestone loader
      (only names differ) — existing loader tests pass, renamed
- [ ] Round-trip: setting/clearing `epic:` is a surgical line edit

## Notes

Carries the c0074 open questions on the container's `status`/`due` fields and
the `e` id prefix — decide here.

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
