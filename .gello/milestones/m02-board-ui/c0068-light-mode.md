---
id: c0068
title: Light mode
status: review
priority: normal
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-18T06:18:45
milestone: m02
---

Need a setting to

* dark mode
* light mode
* follow OS setting

Reachable via the context menu

## What

A **Theme** submenu in the right-click context menu with **Follow OS**
(default), **Light**, and **Dark**. The choice sets `color-scheme` on the
document root (light/dark force it; Follow OS = `light dark` = prefers-color-
scheme) and is persisted app-locally (flag `theme`). The UI already renders
from system colors (`Canvas`/`CanvasText`), so it flips cleanly; the accent
colors (priority/type badges, links) are theme-independent.

## Acceptance criteria

- [x] Context-menu Theme submenu with Follow OS / Light / Dark, current one checked
- [x] Selecting Light/Dark forces that scheme; Follow OS returns to the OS setting
- [x] The choice persists across restarts (app-local flag)
- [x] Light mode renders legibly (verified in-browser: cards, text, badges)

## Log

- 2026-07-17 status → ready (app)
- 2026-07-18 implemented (agent): Theme submenu (Follow OS/Light/Dark) sets
  color-scheme on the document root + persists a `theme` flag. Light-mode
  legibility verified in-browser. App test covers the toggle + persistence.
