---
id: c0153
title: Option to open project folder in the terminal
status: review
created: 2026-08-07
updated: 2026-08-07
status-changed: 2026-08-07T23:22:05
epic: e02
usage-tokens: 17363
usage-cost: 2.233072
---

Make it part of the right click menu

## What

The board background right-click menu gets an "Open in terminal" item, next to
c0152's "Open project folder". It opens an OS terminal window with the working
directory set to the project folder (the folder holding `.gello`).

## Acceptance criteria

- [x] The board context menu has an "Open in terminal" item.
- [x] Selecting it opens a terminal at the project folder — not the `.gello`
      dir.
- [x] A failure (folder gone, unsupported platform, terminal will not launch)
      shows in the error banner instead of being swallowed.
- [x] The Rust side refuses a path that is not an existing directory.

## Notes

- The item sits under c0152's "Open project folder" in the board context menu.
- New Rust module `terminal.rs`, shaped like companion.rs: `open_folder_command`
  builds the invocation (pure, unit-tested), `open_folder` validates and spawns.
  The child is not retained — the terminal window is the user's.
- macOS runs `open -a Terminal <dir>`. The path is its own argv entry, so no
  quoting or shell is involved. Other platforms return `None` and the user gets
  "supported on macOS only for now", matching what c0110 does for the companion.
- Terminal.app is fixed, as in c0110. Picking iTerm/Ghostty/etc. is a separate
  card (i0154).
- `TerminalCommand` moved from companion.rs to terminal.rs; companion re-exports
  it, so its own callers and tests are unchanged.
- The path check reuses c0152's `fs_read::openable_dir`.

## Log

- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
- 2026-08-07 status → review (agent)
