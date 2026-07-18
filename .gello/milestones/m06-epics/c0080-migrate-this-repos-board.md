---
id: c0080
title: Migrate this repo's own board to epics
status: ready
milestone: m06
depends: [c0079]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T06:09:18
---

## What

Run the migration engine (c0079) on this repo's `.gello/` board: the dogfood
cutover. `milestones/m0N-name/` → `epics/e0N-name/`, `milestone.md` →
`epic.md`, `milestone:` → `epic:`, ids remapped, asset links rewritten.

Update the dogfood load test to the epic format so it stays green.

## Acceptance criteria

- [ ] This repo's board is fully converted to the epic format; no
      `milestones/` tree or `milestone:` field remains
- [ ] Relative asset links resolve after the move
- [ ] The dogfood load test (loads `.gello/`) passes with zero invalid files
      against the new format
- [ ] Existing cards' cross-references (depends, refs) still resolve

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
