---
id: c018
title: Archive done cards
status: done
epic: e05
depends: [c006]
tags: [core]
created: 2026-07-16
updated: 2026-07-22
status-changed: 2026-07-22T06:34:30
---

## What

An explicit archive action moves long-done cards into an `archive/` folder in
their own home — `cards/archive/` or `epics/eNN-name/archive/` — to keep
working folders small. Archived cards stay parseable and searchable but off the
board by default.

## Acceptance criteria

- [x] Archive moves the file and rewrites relative asset links
- [x] Archived cards excluded from board by default, visible via toggle
- [x] Card IDs of archived cards are never reused

## Notes

- The card was written pre-epic (`milestones/<m>/archive/`). Translated to the
  epic layout: `archive/` sits inside the card's own home folder, so archiving
  never changes epic membership — only folder depth (asset links gain one
  `../`, rewritten by `retargetAssetLinks`, like triage does).
- `loadBoard` reads `archive/` into the same bucket as its live siblings, with
  `Card.archived` derived from the path (not a frontmatter field). Ids
  therefore keep feeding `nextCardId`, duplicate detection still fires, and
  `findCardById` reaches archived cards.
- Board display: hidden unless Settings › Show archived is on (app-local flag
  `show-archived`), but an active search always shows matches — "off the board,
  still searchable". Shown archived cards are dashed and marked, and cannot be
  dragged or arrow-key moved; moving one would leave it in `archive/` with a
  live status. Unarchive first.
- `archiveCard` / `unarchiveCard` write the new file before removing the old
  one, so an interrupted move leaves a duplicate, never a lost card. Each
  appends a dated Log line.
- The action is offered in the card detail on a `done` card (and reversed from
  the archived card). No bulk "archive everything done" — not asked for.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 implemented archive/unarchive: loader, actions, board toggle,
  detail button; concept.md + CLAUDE.md + scaffold snippet updated
- 2026-07-21 status → review (agent)
- 2026-07-22 status → done (app)
