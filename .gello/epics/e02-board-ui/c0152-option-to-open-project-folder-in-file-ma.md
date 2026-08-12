---
id: c0173
title: Option to open project folder in file manager
status: done
created: 2026-08-07
updated: 2026-08-07
status-changed: 2026-08-07T23:17:54
epic: e02
usage-tokens: 13397
usage-cost: 2.471333
---
Make it part of the right click menu

## What

The board background right-click menu gets an "Open project folder" item that
shows the project folder (the folder containing `.gello`) in the OS file
manager — Finder, Explorer, or whatever the desktop uses. Goes through the
opener plugin in Rust, like the c0151 reference-document open.

## Acceptance criteria

- [x] The board context menu has an "Open project folder" item.
- [x] Selecting it hands the project folder — not the `.gello` dir — to the OS.
- [x] A failure (folder gone, no file manager) shows in the error banner
      instead of being swallowed.
- [x] The Rust side refuses a path that is not an existing directory.

## Notes

- The item sits at the top level of the board context menu, under Reload —
  next to it rather than inside Settings, since it is an action, not a toggle.
- Goes through `open_folder` in Rust (opener plugin), mirroring c0151's
  `open_asset`. The webview never opens a path the Rust side has not checked:
  `fs_read::openable_dir` refuses anything that is not an existing directory.
- The path is `projectFolder(board.root).path` — the folder holding `.gello`,
  which is what the project menu and the companion already use.

## Log

- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
- 2026-08-07 status → review (agent)
- 2026-08-07 status → done (app)
