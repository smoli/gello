---
id: c0057
title: Status bar
status: done
created: 2026-07-17
updated: 2026-07-17
milestone: m02
status-changed: 2026-07-17T08:56:28
---

Shows, project folder we’re working,
git branch

## What

A thin status bar pinned to the bottom of the app shell (IDE convention),
showing at a glance:

- **Project folder** — the name of the directory containing `.gello/`
  (i.e. `dirname(board.root)`'s basename), full path on hover.
- **Git branch** — the current branch of the repo the project lives in.
  Reflected live: the file watcher also watches `.git/HEAD`, so an external
  `git checkout` updates the bar without a reload. When the project is not
  a git repo, the segment reads "not a git repo".
- **Card counts** — a compact per-column tally of the board (e.g.
  `ready 3 · in-progress 2 · review 1 · done 40`), derived from the loaded
  model.

Git access is a new thin Rust command (`git_branch(root)`): keep the Rust
layer minimal — read `.git/HEAD` and resolve the ref, no libgit2 unless a
plain read proves insufficient. Detached HEAD shows the short SHA.

## Acceptance criteria

- [x] Bottom status bar renders the project folder name; hovering shows the
      full path
- [x] Current git branch shows and updates when `.git/HEAD` changes
      externally (watcher-driven, no reload)
- [x] Non-git project shows "not a git repo" in the branch segment
- [x] Detached HEAD shows the short commit SHA (not an empty/undefined
      branch)
- [x] Card counts reflect the live model and update as cards move
- [x] `git_branch` is a covered Rust command (branch, detached, non-repo);
      the branch-derivation logic is unit-tested
- [x] Counts/branch derivation from the model is a pure, tested function

## Discussion

- **Live via the watcher, not poll or read-once**: consistent with gello's
  reactive-to-disk model; `.git/HEAD` is a cheap file to watch and changes
  exactly on checkout. (Rejected: read-once — goes stale; poll — timer +
  lag for no benefit.)
- **Bottom bar with an explicit "not a git repo"**: the absence is
  meaningful (gello is for agentic dev; no repo is worth seeing), so label
  it rather than silently omitting.
- **Card counts included** (beyond the card's literal scope): the bar is
  prime real estate for the board's pulse; counts are free from the model
  already in memory.
- **Thin Rust command, plain `.git/HEAD` read**: the git root is found by
  walking up from the project folder (`.git` may sit at the project root or
  an ancestor). Avoid a git library until a plain read can't answer.
- **Detached HEAD → short SHA**: never show an empty branch; the SHA is the
  honest answer.
- **Open**: worktrees / submodules (`.git` as a file pointing elsewhere) —
  handle now or defer; whether counts should respect the active
  milestone/type filters or always show the whole board.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): scope = folder + branch + card counts,
  live via watcher on .git/HEAD, bottom bar with explicit non-repo label
- 2026-07-17 status → backlog (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Rust `git.rs`: `branch_from_head` (ref → branch, else short SHA),
  `find_git_dir` (walks up; resolves a `.git` *file* pointer for
  worktrees/submodules), `git_branch` (None outside a repo). 5 Rust tests.
- Commands: `git_branch(root)` and `watch_git_head(root)` — the latter
  watches the git dir and emits `git-head-changed`, kept alive in a managed
  slot. App re-fetches the branch on that event → live checkout updates, no
  reload.
- Pure TS `status.ts`: `projectFolder(root)` (name + full path) and
  `cardCounts(model)` (per configured column). StatusBar renders folder
  (path on hover), branch (or "not a git repo"), and counts.
- Open items from discussion deferred: counts always show the whole board
  (not filtered); worktree `.git`-file handled, submodule edge cases not
  specially tested.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (git.rs + status bar), 5 Rust + 8 TS tests, status → review
