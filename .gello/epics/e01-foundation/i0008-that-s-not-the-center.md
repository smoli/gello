---
id: i0008
title: That’s not the center
status: done
type: issue
ref: c022
epic: e01
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:46:18
---

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- The search used `margin: 0 auto` inside a flex toolbar, so it centered in
  the space left of the filters — visibly off to the right. The toolbar is
  now a 3-column grid (`1fr auto 1fr`): filters in the left cell, search in
  the centered middle cell, an empty symmetry cell on the right. The search
  is now centered on the board regardless of filter widths.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 fixed (grid-centered toolbar), status → review
