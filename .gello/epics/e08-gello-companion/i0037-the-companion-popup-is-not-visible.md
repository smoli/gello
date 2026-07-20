---
id: i0037
title: The companion popup is not visible
status: review
type: issue
ref: c0100
epic: e08
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T08:44:30
---

![image](../../assets/i0037/image.png)

## What

The companion runner popover (the list of active runs, c0100) opens when the
runner glyph in the title bar is clicked, but is not visible. The screenshot
shows the glyph and the board's "All types" filter behind it — the popover
content never appears.

## Cause

The popover is an absolutely-positioned descendant of `.titlebar-left`, which
carries `overflow: hidden` for the caption ellipsis. That clips the popover,
which opens below the 24px bar.

## Fix

Render the popover through a portal to `document.body`, positioned under the
glyph, so no title-bar ancestor can clip it.

## Acceptance criteria

- [x] The runs popover is rendered outside the `.titlebar-left` clipping area.
- [x] Clicking the runner glyph still reveals the active runs.

## Notes

- `TitleBar` now portals the popover to `document.body` (`createPortal`) and
  positions it under the glyph via inline `top`/`left` from the button's
  `getBoundingClientRect()`. CSS changed from `position: absolute` (clipped by
  the caption's `overflow: hidden` ancestor) to `position: fixed`.
- New test `i0037: renders the runs popover outside the clipping title area`
  asserts the open dialog is not a descendant of `.titlebar-left` — red before
  the portal, green after. The existing click-reveals-runs test still passes
  (RTL `screen` queries reach the portaled node).
- Two unhandled errors in `App.test.tsx` (`readFileRaw` mock under fake timers)
  are pre-existing — present with these changes stashed — and unrelated.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress; diagnosed overflow-clip, fixing via portal
- 2026-07-20 portal fix + test; typecheck/lint/tests green; status → review
