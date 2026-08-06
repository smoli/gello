---
id: i0131
title: Git integration fails silently
status: done
type: issue
created: 2026-08-05
updated: 2026-08-06
status-changed: 2026-08-06T06:10:06
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

Both commands stop returning a bare `Option` and answer with a reason, the shape
`CommitOutcome` already uses in this codebase — `GitStatus` for the indicator,
`BoardChanges` for auto-commit:

- `not_a_repo` — no `.git` above the board. Decided from the filesystem
  (`find_git_dir`), so it holds even when the git binary is the thing missing.
  Stays silent: not every project is a repo.
- `unavailable { message }` — a repo is there but git could not answer. Carries
  git's own stderr (dubious ownership, a broken repo) or the spawn failure
  (git not on PATH).
- `status { board_dirty, code_dirty }` / `changes { changes }` — as before.

The title bar shows `unavailable` in the corner the dirty dot already owns, with
the reason as its accessible name and tooltip. Auto-commit says
`auto-commit is off: git is unavailable — <reason>` in the error surface it
already uses for a failed commit, instead of returning as if the project had
never asked for commits.

## Acceptance criteria

- [x] Outside a git repo the status is `not_a_repo` and nothing is shown — an
      ordinary non-repo project stays quiet.
- [x] A project that *is* a repo but where git cannot answer reports
      `unavailable` carrying git's reason, not `not_a_repo`.
- [x] Repo-ness is decided without running git, so a missing git binary reads as
      `unavailable`, never as "no repo".
- [x] The title bar renders the reason for `unavailable` — accessible name and
      tooltip — and no dirty dot.
- [x] A clean worktree and an unavailable one are visibly different states.
- [x] The existing dirty-dot behaviour is unchanged: hollow for board-only,
      distinct when code is dirty, nothing when clean.
- [x] Auto-commit names the reason it is doing nothing.

## Notes

- `git_output` is the new seam: one place turns a git invocation into either
  stdout or a reason (spawn failure, else stderr). `repo_top` and `board_prefix`
  return `Result` through it; `run_git` stays for the calls where a non-zero exit
  is an answer rather than a fault (`git show HEAD:<path>` for an added file).
- The `WorktreeStatus` struct survives as the payload of `GitStatus::Status`, so
  the serialized shape the title bar consumes is still
  `{ board_dirty, code_dirty }` with a `kind` beside it.
- Outside Tauri (the browser dev build, component tests) `invoke` throws; that
  maps to `not_a_repo`, not `unavailable`. A missing app boundary is not a git
  fault, and the alternative would put a warning in the title bar of every dev
  build.
- Two sessions worked this card at once, in this one working copy: this one, and
  a companion run that parked a `gelloquestion` asking who owns it, then
  stopped. Its Rust tests for `BoardChanges` were on disk, so the card's second
  half is its design, finished here rather than discarded — the question was
  answered by the situation resolving itself, and is removed rather than left
  parked. Worth knowing that nothing prevents this: the board has no lock, so
  two runs can pick up one card and edit one file. That is [[i0134]].
- Left alone deliberately: `git_branch` still returns `string | null`. It reads
  `.git/HEAD` directly and never shells out, so it has no failure to report.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-06 GitStatus + BoardChanges carry the reason; title bar and
  auto-commit surface it. cargo test 58, frontend 1355, typecheck/lint/clippy
  green
- 2026-08-06 status → review (agent)
- 2026-08-06 status → done (app)
