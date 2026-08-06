---
id: i0127
title: On Windows. Git status is not displayed
status: done
type: issue
created: 2026-08-05
updated: 2026-08-06
status-changed: 2026-08-06T05:57:49
tags: []
epic: e10
---

## What

On Windows the title bar shows the branch but never the uncommitted-changes
dot. The dot renders from `git_worktree_status`; that command returned `None`,
which the title bar renders identically to a clean worktree.

`None` came from `board_prefix()` in `src-tauri/src/git.rs`, which worked out
where `.gello/` sits inside the repo by comparing two spellings of the same
directory: git's `rev-parse --show-toplevel` against a canonicalized `root`.
On Windows those diverge, and every divergence switched off both this
indicator and auto-commit (i0126, same root cause).

Two divergences, one fixed under each card:

1. The extended-length prefix — `\\?\C:\proj\.gello` from `Path::canonicalize`
   against `C:/proj` from git. Fixed under i0126 by normalizing both strings.
2. A substituted or mapped drive (`subst X: C:\proj`, `net use Z: \\srv\sh`) —
   `canonicalize` resolves the mapping through to `C:/proj` or
   `//srv/sh/proj`, while git, with its cwd on `X:`, answers `X:/proj`. No
   string normalization settles that one, so i0126's fix would not have
   covered a board on a mapped drive.

Fix: stop deriving the prefix and ask git for it. `rev-parse --show-prefix`
takes the same cwd git has already resolved and prints the board dir relative
to the repo top — forward slashes, trailing separator, empty at the top. There
is no second spelling left to reconcile, so the whole class is gone rather than
one member of it.

## Acceptance criteria

- [x] `board_prefix` names the board dir relative to the repo top, and is empty
      when the board dir *is* the repo top.
- [x] It is `None` outside a git repo (the one case that must stay silent).
- [x] A board path that reaches the repo by another valid spelling — a
      case-differing path on a case-insensitive filesystem, which is what
      Windows is — still resolves.
- [x] `worktree_status` reports `board_dirty` for a board change reached
      through that spelling, so the indicator appears.
- [x] The existing commit/status behaviour is unchanged: `cargo test` green.

## Notes

- Verified rather than assumed: git answers `--show-toplevel` in the
  directory's real on-disk spelling whatever spelling the caller used, and
  `Path::canonicalize` corrects case on macOS and Windows alike. So i0126's
  normalization did hold for case and for symlinked paths — the mapped-drive
  case is the one it missed.
- The mapped-drive divergence cannot be reproduced on macOS (no `subst`, and
  git resolves symlinks the same way `canonicalize` does), so this landed as
  the refactor step: behaviour pinned by the real-repo tests, mechanism
  swapped underneath them. The tests are behavioural now — a temp repo — where
  i0126's were string-level over `\\?\` shapes.
- i0126's `comparable` / `relative_prefix` are deleted: with the prefix coming
  from git there is nothing left to normalize. i0126 is in review; its fix is
  superseded, not reverted, and its symptom stays fixed.
- Still unverified on Windows — I have no Windows machine here. What is proven
  is that the cause of the `None` is gone and cannot return through path
  spelling. If the dot is still missing on Windows, the next suspects are git
  not being on the app's PATH and `safe.directory` refusing the repo; both
  currently fail silently, which is [[i0131]].
- Filed while auditing the same function: [[i0132]] (git quotes non-ASCII
  paths in porcelain output, so a board asset with an umlaut counts as a code
  change and flips the dot to filled).

## Log

- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 confirmed i0126's fix holds for case and symlink spellings
- 2026-08-05 found the mapped-drive divergence it does not cover
- 2026-08-05 prefix now comes from `rev-parse --show-prefix`; cargo test green
- 2026-08-05 status → review (agent)
- 2026-08-06 status → done (app)
