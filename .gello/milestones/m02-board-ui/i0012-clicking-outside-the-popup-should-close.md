---
id: i0012
title: Clicking outside the popup should close it
status: done
type: issue
ref: c0060
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T11:59:29
milestone: m02
---

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## What

The background picker (c0060) had no way to dismiss by clicking away — only
the Cancel button closed it. Add an invisible full-window backdrop so an
outside click (or right-click) cancels like Cancel does (reverting the live
preview), plus Escape.

## Log

- 2026-07-17 implemented (agent): outside-click / right-click / Escape now
  dismiss the BackgroundPicker via a transparent backdrop, reverting the
  preview like Cancel. Clicks inside the picker still don't close it.
