---
id: c0079
title: Board migration engine — detect, gate, convert
status: review
milestone: m06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T09:20:11
---

## What

Convert any existing milestone-format board to the epic format. There is no
read-alias — an old-format board is gated on open until migrated.

- **Detect** an old board (a `milestones/` tree, `milestone.md`,
  `milestone:` fields, or `m*` ids).
- **Gate**: show a "needs migration" prompt instead of rendering the board.
- **Convert** (one click, recoverable): rename `milestones/`→`epics/` and
  each `mNN-name`→`eNN-name`, `milestone.md`→`epic.md`, `milestone:`→`epic:`,
  remap ids `mNN`→`eNN` consistently across folder names and field values,
  rewrite relative asset links. Write the new tree before removing the old.

## Acceptance criteria

- [x] Detection recognises an old milestone-format board on open
- [x] An un-migrated board is gated (does not render as a board)
- [x] One-click conversion performs the full rename + id remap + link rewrite
- [x] Migration is recoverable — new tree written before old removed; an
      interruption never leaves a half-deleted board
- [x] Post-migration board loads with zero invalid files

## Notes

Carries the c0074 open question: whether a non-git board gets an explicit
backup before the in-place rewrite. Distinct from [[c029]] (onboarding a
foreign format) — this converts gello's own prior format.

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): pure engine `src/lib/migration.ts`
  (`isLegacyBoard` + `planMigration`, surgical mNN→eNN frontmatter edits,
  writes-before-deletes). `migrateBoard`/`migrateLegacyBoard` apply on disk
  (write new epics tree, then remove milestones/ wholesale). `LoadedBoard.legacy`
  flag; App gates a legacy board with `MigrationGate` (board never renders old
  format). Asset links unchanged by design — folder depth is preserved and
  assets are keyed by card id. Note for c0080: loadBoard still parses legacy
  milestones/ (dogfood load stays green); the gate is app-only. Full suite +
  typecheck + lint green.
