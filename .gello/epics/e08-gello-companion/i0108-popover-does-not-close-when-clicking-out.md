---
id: i0108
title: Popover does not close when clicking outside
status: done
type: issue
ref: c0100
epic: e08
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T17:57:46
---

Companion popover should close when I click outisde

## Acceptance criteria

- [x] Clicking anywhere outside the companion runs popover closes it.
- [x] Clicking inside the popover keeps it open.
- [x] The toggle button still opens and closes the popover.

## Notes

The runner popover (`TitleBar.tsx`, c0100) only toggled via its button — no
outside-click dismissal. It renders in a portal on `<body>`, so an ancestor
click or `onBlur` won't catch outside clicks. Added a document `mousedown`
listener active only while the popover is open; it closes unless the click
lands on the toggle button or inside the popover (both tracked by refs).

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 status → review (agent)
- 2026-07-20 status → done (app)
