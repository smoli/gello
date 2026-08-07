---
id: i0139
title: Dropping a card on its original position puts it a the end
status: review
type: issue
ref: c0149
epic: e02
created: 2026-08-06
updated: 2026-08-06
status-changed: 2026-08-06T19:28:20
usage-tokens: 15247
usage-cost: 26.073145
---

## What

Regression from c0149. Dragging a card in a manual column (backlog/ready) and
dropping it back where it started sent it to the **bottom** of the column
instead of leaving it in place.

## Acceptance criteria

- [x] Dropping a card back on its own (dimmed) origin card is a no-op
- [x] Dropping on a muted origin-adjacent insert zone is a no-op
- [x] The c0149 ghost-area behaviour is unchanged — a drop in the empty area
      below the cards, or from another column, still lands at the bottom

## Notes

- Cause: c0149 made the full-height column track route any manual-column drop
  to `onDropAt(cards.length)` (bottom). But a drop on the card's origin bubbles
  to that track: the muted zones flanking the dragged card (i0006) did
  `if (muted) return` *without* `stopPropagation`, and the dimmed origin card
  had no `onDrop` at all — so both fell through to the track's bottom-insert.
- Fix: both swallow the drop as a no-op. The muted `InsertZone` now
  `preventDefault` + `stopPropagation`s before its early return, and the origin
  `CardFront` (`isOrigin`) gets an `onDrop` that does the same. Non-origin cards
  and genuine ghost-area drops still fall through to the track (c0149 intact).

## Log

- 2026-08-06 status → ready (app)
- 2026-08-06 status → backlog (app)
- 2026-08-06 status → ready (app)
- 2026-08-06 status → in-progress (agent)
- 2026-08-06 muted zones + the origin card now swallow their drop (no-op)
  instead of falling through to c0149's bottom-insert — 2 tests
- 2026-08-06 status → review (agent)
