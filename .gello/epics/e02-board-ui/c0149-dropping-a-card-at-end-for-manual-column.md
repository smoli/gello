---
id: c0149
title: Dropping a card at end for manual columns
status: review
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T23:45:20
epic: e02
---

Ordering in Backlog and ready is manual. If the column is short and the user drops a card below the short column in the „ghost“ area of the column, the card should be order in at the bottom

## Acceptance criteria

- [x] Dropping a card in the empty ghost area of a manual column (backlog/ready)
      lands it at the bottom of that column
- [x] Works for a same-column drop (reorder to the bottom) and a cross-column
      drop (move in, ranked at the bottom)
- [x] Non-manual columns are unaffected — a ghost drop there is still a plain
      status change
- [x] The inbox-triage and picker paths still fire, now carrying the bottom
      slot order (as the i0015 insert-zone drop already does)

## Notes

- The bug: the full-height column track (c052) catches drops that miss the
  insert zones — i.e. the ghost area below the last card. Its handler
  (`dropOnColumn`) only ever did a bare status change, so a **same-column**
  ghost drop did nothing at all, and a cross-column one landed unranked.
- Fix is one branch in the track's `onDrop`: for a manual column
  (`showInsertZones`), route to `onDropAt(path, cards.length)` — the trailing
  insert position, exactly what the last insert zone does — instead of the bare
  `onDropCard`. Same-column → `onReorderCard` to the bottom; cross-column →
  `onMoveCard` with a bottom rank; inbox card → the picker with the bottom
  order. Non-manual columns keep `onDropCard`.
- Three existing inbox/milestone drop tests were updated (not weakened): a
  ghost drop on a manual column now carries the bottom `order` to
  `onInboxStatusDrop` / `onMoveCard`, which is the genuine, more consistent
  behaviour this card introduces.

## Log

- 2026-08-05 status → discuss (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 ghost-area drop on a manual column routes to the trailing insert
  position, so the card lands at the bottom — 3 tests, 3 updated
- 2026-08-05 status → review (agent)
