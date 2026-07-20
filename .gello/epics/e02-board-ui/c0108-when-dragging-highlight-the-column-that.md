---
id: c0108
title: When dragging highlight the column that the mouse is over
status: done
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:32:57
epic: e02
---

## What

During a card drag, highlight the column the pointer is currently over so the
drop target is unmistakable. The idle drop lanes already show a faint dashed
outline (c054/i001); the column under the pointer gets a stronger, solid
highlight that follows the pointer across lanes.

## Acceptance criteria

- [x] While dragging, the column-track under the pointer carries a
  `column-track-over` marker; the others do not.
- [x] Moving the pointer to another column moves the highlight with it (only
  one column highlighted at a time).
- [x] The highlight clears when the drag ends (drop or cancel).

## Notes

- Implemented: `overColumn` state in `Board`, set from each track's
  `onDragOver` (fires on whichever track is under the pointer, so a single
  column stays highlighted and follows the pointer). Cleared via `setDragState`
  when the drag ends. `Column` renders `column-track-over` when `isOver`.
  CSS: `.board-dragging .column-track-over` → solid outline + stronger fill.
- Tests (Board.test.tsx, both green): highlight follows the pointer across
  columns; clears on drag end; clears after a drop.

### Commit — resolved

c0108 shared `Board.tsx`/`Board.css`/`Board.test.tsx` with concurrent c0058
(tag chips + filter) work. Per the human's call, c0058 landed first
(`25be69e`); the c0108 changes are self-contained and were then committed on
top on their own, leaving the c0058 follow-up (tag rename / manager) untouched.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 c0108 implemented + tests green; commit blocked by concurrent c0058 work in shared board files — asked human (agent)
- 2026-07-20 c0058 landed first (25be69e); committed c0108 on the clean base as 950cb6a; → review (agent)
- 2026-07-20 status → review (agent)
- 2026-07-20 status → done (app)
