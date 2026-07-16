---
id: c050
title: There should be no vert scrollbar on the app
status: done
priority: normal
type: issue
created: 2026-07-16
updated: 2026-07-16
milestone: m02
---

Since the columns scroll on their own there should be no vert scrollbar on the whole app. yet there is one

## Log

- 2026-07-16 status → ready (app)
- 2026-07-16 status → done (app)

## Notes

- Cause: the error banner (and lane) stacked above a 100vh board — total
  height exceeded the viewport. Fix: an `.app-shell` flex column owns the
  viewport (html/body/#root locked to 100%, overflow hidden); the board
  flexes into the remaining space. Columns keep their internal scroll.

## Log

- 2026-07-16 status → ready (app)
- 2026-07-17 fixed (app shell layout), status → review
