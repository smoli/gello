---
id: c0063
title: Showing image thumbnails in board should be a setting
status: done
priority: normal
created: 2026-07-17
updated: 2026-07-17
milestone: m02
status-changed: 2026-07-17T14:30:22
---

Add a settings entry to the conteext menu. Right now can just have a „submenu“ with the one entry to show the thumbnails


## What

The board-card thumbnails (c012) are now toggleable from the right-click menu:
a **Settings** submenu (i0011 context menu) with a **Show thumbnails** checkbox
item. The preference is app-local (persisted in flags.json as `show-thumbnails`,
default on) — a viewing preference, not board data. Off → cards render without
thumbnails.

## Acceptance criteria

- [x] Right-click menu has a Settings submenu with a "Show thumbnails" toggle
- [x] Toggling hides/shows thumbnails on all board cards immediately
- [x] The choice persists across restarts (app-local flag)

## Notes

- ContextMenu gained submenu (`items`) and checkable (`checked`) item support.
- Board gating is implicit: App passes `loadImage` to Board only when the
  setting is on (Board's loadImage is thumbnail-only), so off = no thumbnails.
- Submenu flyout verified in the in-app browser.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): ContextMenu submenu + checkable items;
  Settings › Show thumbnails toggle persisted app-locally; Board thumbnails
  gated on the setting. Tests: ContextMenu submenu/toggle, App toggle+persist.
- 2026-07-17 status → done (app)
- 2026-07-17 fixed (agent): submenu hover-intent — flush flyout (no gap) plus
  a 250ms close delay, so moving from Settings to the toggle no longer
  dismisses it. Fake-timer tests added.
