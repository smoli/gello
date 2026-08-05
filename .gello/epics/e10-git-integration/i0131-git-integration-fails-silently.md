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

## Design

`git_worktree_status` stops returning a bare `Option` and answers with a reason,
the shape `CommitOutcome` already uses in this codebase:

- `not_a_repo` — no `.git` above the board. Decided from the filesystem
  (`find_git_dir`), so it holds even when the git binary is the thing missing.
  Stays silent: not every project is a repo.
- `unavailable { message }` — a repo is there but git could not answer. Carries
  git's own stderr (dubious ownership, a broken repo) or the spawn failure
  (git not on PATH).
- `status { board_dirty, code_dirty }` — as before.

The title bar shows `unavailable` in the corner the dirty dot already owns, with
the reason as its accessible name and tooltip. One place computes availability,
one place shows it — `runAutoCommit` keeps its early return, because the reason
is now visible while it stays silent.

## Acceptance criteria

- [ ] Outside a git repo the status is `not_a_repo` and nothing is shown — an
      ordinary non-repo project stays quiet.
- [ ] A project that *is* a repo but where git cannot answer reports
      `unavailable` carrying git's reason, not `not_a_repo`.
- [ ] Repo-ness is decided without running git, so a missing git binary reads as
      `unavailable`, never as "no repo".
- [ ] The title bar renders the reason for `unavailable` — accessible name and
      tooltip — and no dirty dot.
- [ ] A clean worktree and an unavailable one are visibly different states.
- [ ] The existing dirty-dot behaviour is unchanged: hollow for board-only,
      distinct when code is dirty, nothing when clean.

## Notes

## Log

- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
