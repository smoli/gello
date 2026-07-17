---
id: i0006
title: Taller drop indicator and animate the opening gap
status: review
priority: normal
type: issue
ref: i0004
milestone: m02
created: 2026-07-17
updated: 2026-07-17
---

The blue dropzone indicator still has the original (thin) height, and the
cards should animate when moving apart to open the landing gap.

## Log

- 2026-07-17 reported (Stephan), picked up (agent)

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
