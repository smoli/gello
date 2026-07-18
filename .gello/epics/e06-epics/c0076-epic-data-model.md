---
id: c0076
title: Epic data model — rename milestone→epic in schema + loader
status: done
epic: e06
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T07:24:19
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

- [x] `epic:` parses where `milestone:` did; `epic.md` parses where
      `milestone.md` did; `Epic` type replaces `Milestone`
- [x] Loader reads three homes: `inbox/`, `epics/eNN-name/` (epic-grouped),
      and `.gello/cards/` (standalone, no epic)
- [x] `e`-namespace id allocation for epics; standalone cards keep the
      c-namespace
- [x] Grouping/ordering behaviour is unchanged from the milestone loader
      (only names differ) — existing loader tests pass, renamed
- [x] Round-trip: setting/clearing `epic:` is a surgical line edit

## Notes

Carries the c0074 open questions on the container's `status`/`due` fields and
the `e` id prefix — decide here.

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
- 2026-07-18 status → done (app)
- 2026-07-18 status → review (app)
- 2026-07-18 status → done (app)

## Notes

- Decided (c0074 open questions): epic id namespace is `eNN`; `epic.md`
  carries id + title + status (dropped `due`).
- Loader is **backward-compatible** (user's call): reads `epics/eNN/epic.md`
  AND legacy `milestones/mNN/milestone.md`, plus flat `.gello/cards/`
  standalone and `inbox/`. A legacy `milestone:` field maps to `epic`. This
  keeps this repo's board loading until c0080 migrates it.
- Scope handoffs: standalone cards are *loaded* into `model.cards` but not yet
  *rendered* on the board (the "No epic" board treatment is c0077). The UI
  vocabulary (filter/label strings still say "milestone", the picker component
  name) also stays until c0077. triage still writes to `milestones/<folder>/`
  for this repo's legacy folders — the `epics/` path lands with the migration.

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 implemented (agent): renamed milestone→epic across schema
  (Epic/parseEpic/Card.epic) + loader (EpicGroup/model.epics, reads
  epics/+cards/+legacy milestones/) + nextEpicId (e-namespace); consumers use
  the new data names, UI vocabulary deferred to c0077. Backward-compatible;
  full suite green (loader tests renamed + new-format tests added).
