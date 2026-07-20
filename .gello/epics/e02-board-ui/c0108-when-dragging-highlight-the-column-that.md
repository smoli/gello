---
id: c0108
title: When dragging highlight the column that the mouse is over
status: in-progress
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T17:49:15
epic: e02
awaiting: input
---

```gelloquestion
**c0108 is implemented and its tests pass, but I can't commit cleanly.**

The working tree also holds live, unfinished **c0058** (tag chips + tag filter) work, interleaved with my c0108 changes across the same shared files — `Board.tsx`, `Board.css`, `Board.test.tsx` (plus its own `lib/tags.ts`). The c0058 tests are red and its unused import fails `pnpm typecheck`, so the full suite isn't green. Looks like another agent/session is mid-c0058 in this same tree.

How should I commit c0108?

- [ ] Wait — let c0058 land first (or you'll commit it), then I commit c0108 on top with a green suite. I'll exit now and you resume me.
- [ ] Commit only my c0108 hunks now via a non-destructive staged patch (`git apply --cached`), leaving all c0058 edits untouched on disk. My commit would be scoped and green; c0058 stays uncommitted for the other agent.
- [ ] Something else (tell me on the card).

For context, my c0108 changes are self-contained: `overColumn`/`setDragState` state in `Board`, `isOver`/`onOver` on `Column`, the `column-track-over` class, its CSS rule, and two Board tests. They don't depend on c0058.
```

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

### Blocked on commit — concurrent c0058 work in the same files

The working tree has live, unfinished **c0058** (tag chips + tag filter) work
interleaved with my c0108 changes across all three shared files: `Board.tsx`,
`Board.css`, `Board.test.tsx` (plus its own `lib/tags.ts`). The c0058 tests are
currently red (tag rendering/filter not yet implemented) and its unused import
fails `pnpm typecheck`, so the full suite is not green and I can't commit c0108
cleanly without either committing that unfinished work or surgically splitting
it out of shared files. See the question below.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 c0108 implemented + tests green; commit blocked by concurrent c0058 work in shared board files — asking human (agent)
