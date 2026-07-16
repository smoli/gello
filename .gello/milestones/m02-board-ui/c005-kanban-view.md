---
id: c005
title: Kanban view (read-only) with milestone filter
status: backlog
milestone: m02
priority: high
depends: [c003]
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Render the BoardModel as a Kanban board: columns from board.yaml, cards
grouped by status, card fronts showing title, id, milestone, priority, and
tags. Filter (or swimlanes) by milestone.

## Acceptance criteria

- [ ] Columns render from board.yaml config, in order
- [ ] Cards appear in the column matching their status
- [ ] Milestone filter narrows the board; "all" shows everything
- [ ] Card front shows id, title, milestone, priority
- [ ] Empty columns and empty board render sensibly

## Notes

## Log

- 2026-07-16 created from concept breakdown
