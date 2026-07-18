---
id: i0002
title: Manual resorting jitters
status: done
type: issue
ref: c056
epic: e02
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:18:55
---

When I drag the card just on the edge of the „in between“ dropzone, it „blinks“

Also „in between" drop zone could be a bit taller

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Cause: the insert zone changed box size on activation (height 10→6px,
  margin −5→2px = a 6px net shift). At the zone edge that shift moved the
  element out from under the pointer → dragleave → deactivate → shift back →
  dragover → reactivate → blink.
- Fix: the zone's box is now constant. During a drag it's an 18px hit area
  (taller, as requested) with margin −9px (net 0 flow, cards don't move);
  the insertion indicator is a child bar toggled by opacity via ::before, so
  activation never changes layout. No reflow → no jitter.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 fixed (constant-footprint insert zones), status → review
