---
id: i0003
title: Cannot drag issues out of backlog
status: done
priority: normal
type: issue
created: 2026-07-17
updated: 2026-07-17
milestone: m02
status-changed: 2026-07-17T08:04:40
---

Key board move works

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Cause (real-DOM, WKWebView-specific — like c006's dragDropEnabled find):
  insert zones were mounted into manual columns only *while dragging*. On
  dragstart the app inserted a zone node immediately adjacent to the drag
  source, and WebKit aborts a native drag when the source's DOM/layout is
  mutated during dragstart. Only backlog/ready (manual) mount zones into the
  source, so only those columns lost drag; other columns and keyboard moves
  were unaffected — matching the report exactly.
- Fix: insert zones are now **always mounted** for manual columns and inert
  (zero-footprint, pointer-events none) until a drag; their appearance and
  interactivity are driven purely by the `board-dragging` CSS class. No node
  is inserted or removed at dragstart, so the native drag is never aborted.
- Not reproducible in jsdom (no real drag engine); test contract updated to
  assert zones are always present in manual columns (the fix's mechanism).
  Needs a click-test in the packaged app to confirm on WebKit.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 fixed (always-mounted zones, no dragstart DOM mutation), status → review
