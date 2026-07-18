---
id: i0015
title: Dragging from index to backlog ignores selected pos
status: done
type: issue
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T14:15:23
epic: e02
---

Although I specifically select a position in backlog on where to drop from another column it card is added at the bottom

Same in Redy Column

## What

Two requirements, both needed:
1. **Keep the milestone picker** when dragging a milestone-less inbox card
   onto backlog/ready (i0005) — otherwise you can't triage from the inbox.
2. **Respect the dropped position** — a positioned insert-zone drop must land
   the card at that slot, not the bottom.

Fix: `dropAtIndex` computes the slot order and passes it *through* the picker
(`onInboxStatusDrop(card, status, order)`). Choosing a milestone triages the
card into it at that order; dismissing places it there too. `triageCard` and
the picker flow gained an optional `order`. Loose column-track drops
(`dropOnColumn`) still open the picker without a position, as before.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 fixed (agent): positioned insert-zone drops now carry the slot
  order THROUGH the milestone picker — pick triages to that slot, dismiss
  places there. (Superseded a first cut that wrongly dropped the picker.)
  Tests: Board routing, triageCard order, App pick-at-slot integration.
- 2026-07-17 status → done (app)
