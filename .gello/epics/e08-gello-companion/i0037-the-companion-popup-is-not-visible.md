---
id: i0037
title: The companion popup is not visible
status: in-progress
type: issue
ref: c0100
epic: e08
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T08:42:26
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

- [ ] The runs popover is rendered outside the `.titlebar-left` clipping area.
- [ ] Clicking the runner glyph still reveals the active runs.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress; diagnosed overflow-clip, fixing via portal
