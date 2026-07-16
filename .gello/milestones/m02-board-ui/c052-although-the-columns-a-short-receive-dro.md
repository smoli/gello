---
id: c052
title: although the columns a short receive drops over the full height
status: done
priority: normal
created: 2026-07-16
updated: 2026-07-16
milestone: m02
---

## Log

- 2026-07-16 status → ready (app)
- 2026-07-16 status → done (app)

## Notes

- Each column now sits in an invisible full-height `.column-track` that owns
  the drop handlers — dropping anywhere in the lane (including the empty
  space below a short column) lands the card. Visible columns stay
  content-height (c049); events from the column bubble to the track, so
  drops on the column itself work unchanged.

## Log

- 2026-07-16 status → ready (app)
- 2026-07-17 fixed (track wrapper), test-first, status → review
