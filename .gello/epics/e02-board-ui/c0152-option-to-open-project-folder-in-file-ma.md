---
id: c0152
title: Option to open project folder in file manager
status: in-progress
created: 2026-08-07
updated: 2026-08-07
status-changed: 2026-08-07T23:09:55
epic: e02
---
Make it part of the right click menu

## What

The board background right-click menu gets an "Open project folder" item that
shows the project folder (the folder containing `.gello`) in the OS file
manager — Finder, Explorer, or whatever the desktop uses. Goes through the
opener plugin in Rust, like the c0151 reference-document open.

## Acceptance criteria

- [ ] The board context menu has an "Open project folder" item.
- [ ] Selecting it hands the project folder — not the `.gello` dir — to the OS.
- [ ] A failure (folder gone, no file manager) shows in the error banner
      instead of being swallowed.
- [ ] The Rust side refuses a path that is not an existing directory.

## Log

- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
