---
id: c018
title: Archive done cards
status: backlog
milestone: m05
priority: low
depends: [c006]
tags: [core]
created: 2026-07-16
updated: 2026-07-17
order: 70
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
