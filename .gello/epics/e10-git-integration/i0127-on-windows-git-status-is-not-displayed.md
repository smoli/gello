---
id: i0127
title: On Windows. Git status is not displayed
status: ready
type: issue
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T11:49:26
tags: []
epic: e10
order: 10
---

## Notes

- 2026-08-05 (i0126): same root cause, and likely already fixed. `board_prefix()`
  in `src-tauri/src/git.rs` matched the canonicalized board path (`\\?\C:\…` on
  Windows) against git's `C:/…` toplevel with `Path::strip_prefix`, which never
  matches. `worktree_status()` returned `None` from there, so the app showed no
  git status. Fixed in a166f76 by comparing normalized strings. Needs verifying
  on Windows before this card closes.

## Log

- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
