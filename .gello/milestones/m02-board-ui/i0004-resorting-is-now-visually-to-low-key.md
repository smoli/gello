---
id: i0004
title: Resorting is now visually to low key
status: done
priority: normal
type: issue
ref: i0002
milestone: m02
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:18:57
---

The inbetween drop area should be higher and I want to see where I dragged the card from, by leaving a dahes outline.

I know moving carda apart for the drop zone was the cuase for the jitter, but mayber there’s a way

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Higher drop area: hit zone grown to 28px (from 18) during a drag; the
  indicator bar is thicker/brighter.
- Real landing gap without jitter: when a zone is active, the card *below*
  it gets a 34px top margin — the pointer sits on the zone (constant box),
  so pushing the card below never moves the element under the cursor →
  no dragleave/dragover flicker. This is the "way" the reporter hoped for:
  the gap opens beneath the target line, not by resizing the target.
- Origin placeholder: the dragged card stays in place as a dashed, dimmed
  outline (same box size, no reflow) so you can see where it came from.
- Threaded the dragging card's path to CardFront for the origin class;
  covered by a test. Rest is styling.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 taller zone + landing gap + origin placeholder, status → review
