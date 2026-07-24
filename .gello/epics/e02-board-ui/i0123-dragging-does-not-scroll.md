---
id: i0123
title: Dragging does not scroll
status: review
type: issue
created: 2026-07-24
updated: 2026-07-24
status-changed: 2026-07-24T21:54:27
epic: e02
---

When raging a card to or within a column that have a scroll bar, dragging does not scoll up or down when reaching the edge. That means dragging something from the bottom to the top I need to drag, drop, scroll, drag, drop, scroll, ...

## Acceptance criteria

- [x] Dragging a card near the bottom edge of a scrollable column scrolls it
      down; near the top edge, up
- [x] The scroll keeps going while the pointer holds still at the edge — not
      only while it is moving
- [x] Speed ramps up the closer the pointer is to the edge
- [x] No scrolling from the column's calm middle, or once the pointer has left
      the column
- [x] Auto-scroll runs only during a drag and stops on drop / drag-end
- [x] The speed-from-pointer-position logic is a pure, unit-tested function

## Notes

- Root cause: HTML5 drag-and-drop does not auto-scroll an inner overflow
  container at its edges, and WKWebView (the app's runtime) has no native
  inner-container autoscroll at all — so a long column had to be scrolled by
  hand between drops.
- The testable core is `edgeScrollDelta(rect, pointerY, cfg)` in
  `autoscroll.ts`: pixels to add to `scrollTop` this frame, ramped from 0 at
  the band boundary to `maxSpeed` at the edge, 0 in the middle or outside the
  container; the nearer edge wins when a short column's bands overlap. Nine
  unit tests.
- The wiring in `Board` is DOM glue (jsdom has neither layout nor rAF, so it is
  not unit-tested, like the other WebKit drag handling): while a card is
  dragged, a `dragover` listener records the pointer in a ref and a rAF loop
  scrolls the `.column-cards` under it. The loop — not dragover alone — is what
  makes it keep scrolling when the pointer holds still, since HTML5 dnd fires
  `dragover` only on movement. The listener and loop are torn down on drag-end.
- Scope: vertical column scroll, the reported problem. Horizontal auto-scroll
  of the board itself (dragging past the left/right edge) is left out.
- **Real-app check worth doing:** the behaviour can't be exercised headless;
  the band size (60px) and speed (16px/frame) are a first cut to tune live.

## Log

- 2026-07-24 status → ready (app)
- 2026-07-24 status → in-progress (agent)
- 2026-07-24 edge auto-scroll while dragging: pure edgeScrollDelta (9 tests) +
  a rAF loop in Board scrolling the column under the pointer
- 2026-07-24 status → review (agent)
