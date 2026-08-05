---
id: i0131
title: Git integration fails silently
status: in-progress
type: issue
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T23:54:33
epic: e10
---

## What

Every git feature switches off with no signal when the Rust layer can't answer:
`git_worktree_status` returning `None` renders exactly like a clean worktree,
and `git_board_changes` returning `None` makes `runAutoCommit` return as if the
project were not a repo. "Not a repo", "git is not on PATH", "git refused the
directory (`safe.directory`)" and "clean" are one indistinguishable state.

That is why i0126 and i0127 were two separate reports of one root cause, and
why neither could be diagnosed from what the app showed.

Worth deciding what the title bar should say when git is present but
unavailable — and whether the reason belongs in the error surface the board
already has.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
