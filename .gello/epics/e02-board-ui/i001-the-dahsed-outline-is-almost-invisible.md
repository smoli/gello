---
id: i001
title: The dashed outline is almost invisible
status: in-progress
type: issue
ref: c052
epic: e02
created: 2026-07-17
updated: 2026-07-20
status-changed: 2026-07-20T17:42:58
---

This is of course dependend on the background which can be chnaged by the user

## What

The dashed outline marking a valid drop lane while dragging a card (c054) was
`#4c8bf5` blue at 40% opacity over a 4% fill. The board can carry a full-image
background (c047), so on many images the faint translucent stroke was almost
invisible. Make the drop lane read on any background.

## Acceptance criteria

- [x] The drop-lane outline uses a solid accent stroke (not a 40%-opacity
      translucent one) so it does not wash out against a light background.
- [x] The lane fill is strong enough to distinguish an active lane from the
      others while dragging.
- [x] No behavioural change: the outline still shows only while dragging and
      never on the inbox lane (existing `.board-dragging` tests stay green).

## Notes

- Pure styling change in `Board.css` (the `.board-dragging .column-track`
  rule), so no new test per CLAUDE.md §7. The wiring it hangs off — the
  `.board-dragging` class toggling on drag start/end — is already covered by
  Board.test.tsx.
- Kept the accent colour `#4c8bf5` for consistency with the card-origin
  placeholder (i0004) and the rest of the drag affordances; only the stroke
  opacity (40% → solid) and fill (4% → 14%) changed.
- A single colour can't guarantee contrast against every possible background
  image, but a solid saturated stroke plus a stronger tint is a large,
  low-risk improvement over the faint translucent version. Human to eyeball
  against their chosen background in review.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → backlog (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 status → backlog (app)
- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
