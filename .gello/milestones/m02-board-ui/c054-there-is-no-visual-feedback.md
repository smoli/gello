---
id: c054
title: There is no visual feedback
status: done
type: issue
ref: c052
milestone: m02
created: 2026-07-16
updated: 2026-07-16
---

dashed outline on what the full height column woudl be

## Log

- 2026-07-16 status → ready (app)
- 2026-07-16 status → done (app)

## Notes

- While a drag is active the board gets a `board-dragging` class and every
  drop lane renders a dashed outline + faint tint over its full height —
  the inbox track is excluded (it's not a drop target). Class toggling is
  tested; the outline itself is CSS.

## Log

- 2026-07-16 status → ready (app)
- 2026-07-17 fixed (drag-state lane feedback), status → review
