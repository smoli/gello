---
id: i0011
title: I expect a proper context menu
status: review
priority: normal
type: issue
ref: c0060
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T11:51:16
milestone: m02
order: 10
---

There will likely be more options in the future.
Also the reload option of the native one was nice.

So first context menu with reload and background then the popup

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): right-click background now opens a real
  context menu (ContextMenu component) with Reload + Background…; Background…
  opens the c0060 picker at the click point. Extensible items list for
  future options; Escape / outside-click / re-right-click dismiss.
