---
id: c048
title: App should remember last window size
status: done
priority: normal
created: 2026-07-16
updated: 2026-07-17
milestone: m02
status-changed: 2026-07-17T11:20:36
---

on some OSes there’s services for that

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## What

Persist the window size (and position) across restarts — the OS/toolkit has
services for this, so use them rather than hand-rolling resize listeners.

## Acceptance criteria

- [x] Window size and position are restored on relaunch
- [x] Uses the platform-standard mechanism (Tauri window-state plugin), not a
      custom save/restore path

## Notes

- Added `tauri-plugin-window-state` (auto-saves on exit, restores on window
  creation — overriding the tauri.conf default 800×600 with the saved state).
  One plugin registration; no JS, no custom persistence.
- Behavioral feature (window geometry): not unit-testable in jsdom; verified
  by relaunch — the plugin is the standard, well-tested mechanism.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 window-state plugin added, status → review
