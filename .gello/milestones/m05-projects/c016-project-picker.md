---
id: c016
title: Folder picker + recent projects
status: done
milestone: m05
priority: normal
depends: [c005]
tags: [ui]
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T10:01:52
---

## What

Open any repo via native folder picker; detect `.gello/`; keep a
recent-projects list (app-local settings, not in the repo). Switching
projects swaps the board.

## Acceptance criteria

- [x] Picker opens a repo and renders its board
- [x] Recent projects persist across app restarts
- [~] Repo without `.gello/` → placeholder ('no board'); the actual init flow is c017 (not built) — see Notes

## Notes

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Native folder picker via tauri-plugin-dialog (`pickFolder`); `loadBoardAt`
  walks up from the chosen folder for `.gello` (new `find_board_root_at`
  command) and swaps the board. All root-keyed effects (git branch,
  background, watcher, skills) re-run on switch automatically.
- Recent-projects list is app-local (OS app-config dir via the c032 flag
  store, key `recent-projects`) — never in the repo. Pure `recent.ts`
  (add/dedupe/cap-8, JSON round-trip) with 6 tests; project menu in the
  toolbar with recent entries + "Open folder…".
- **Third criterion deferred**: a folder without `.gello/` currently yields
  the "No board loaded" placeholder; routing to an init/scaffold flow is
  c017 (backlog, not built). Marked `[~]` rather than faked.
- Native dialog is Tauri-only — verified by rebuild + manual test; the
  switch orchestration is covered by an App test with mocked IO.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 folder picker + recent projects + board switching, 10 tests, status → review
