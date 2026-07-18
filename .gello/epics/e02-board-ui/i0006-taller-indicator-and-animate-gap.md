---
id: i0006
title: Taller drop indicator and animate the opening gap
status: done
type: issue
ref: i0004
epic: e02
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:18:47
---

The blue dropzone indicator still has the original (thin) height, and the
cards should animate when moving apart to open the landing gap.

## Log

- 2026-07-17 reported (Stephan), picked up (agent)
- 2026-07-17 status → done (app)

## Notes

- Indicator is now a tall (40px) translucent slot with an inset border, not
  a 4px line — it grows via the absolutely-positioned ::before, so no reflow.
- The landing gap (card below the active zone) transitions margin-top 0.12s,
  and the indicator fades/grows over the same duration, so cards animate
  apart smoothly.
- Renumbered i0005 → i0006: collided with a concurrently captured inbox
  i0005; c031 duplicate detection caught it via the dogfood test.

## Log

- 2026-07-17 reported (Stephan), picked up (agent)
- 2026-07-17 taller slot indicator + animated gap, renumbered past collision, status → review

## Follow-up (Stephan feedback)

- Indicator alignment fixed: it was centered on the thin zone so it reached
  up into the card above. It now grows *downward* from the zone line into the
  gap that opens below (height 0 → 40px, top anchored, no translate).
- Origin-adjacent zones muted: the two zones flanking the dragged card are
  no-op positions (dropping there leaves it in place), so they no longer light
  up or accept drops. They stay mounted (inert via class) — unmounting nodes
  next to the drag source would re-trigger the i0003 WebKit abort.
- Test-harness note: asserting the muted state needed a single synchronous
  read of all zone classes after dragstart; per-index getByLabelText + drop
  was flaky under React 19 fireEvent flushing.

## Log

- 2026-07-17 alignment + origin-adjacent muting, status → review
