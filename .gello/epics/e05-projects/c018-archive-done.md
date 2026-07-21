---
id: c018
title: Archive done cards
status: in-progress
epic: e05
depends: [c006]
tags: [core]
created: 2026-07-16
updated: 2026-07-21
status-changed: 2026-07-21T22:11:52
---

## What

An explicit archive action moves long-done cards into
`.gello/milestones/<m>/archive/` to keep working folders small. Archived
cards stay parseable and searchable but off the board by default.

## Acceptance criteria

- [ ] Archive moves the file and rewrites relative asset links
- [ ] Archived cards excluded from board by default, visible via toggle
- [ ] Card IDs of archived cards are never reused

## Notes

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
