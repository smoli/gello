---
id: c0153
title: Option to open project folder in the terminal
status: in-progress
created: 2026-08-07
updated: 2026-08-07
status-changed: 2026-08-07T23:16:16
epic: e02
---

Make it part of the right click menu

## What

The board background right-click menu gets an "Open in terminal" item, next to
c0152's "Open project folder". It opens an OS terminal window with the working
directory set to the project folder (the folder holding `.gello`).

## Acceptance criteria

- [ ] The board context menu has an "Open in terminal" item.
- [ ] Selecting it opens a terminal at the project folder — not the `.gello`
      dir.
- [ ] A failure (folder gone, unsupported platform, terminal will not launch)
      shows in the error banner instead of being swallowed.
- [ ] The Rust side refuses a path that is not an existing directory.

## Log

- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
