---
id: i0126
title: Moving to done is not commited
status: in-progress
type: issue
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T11:49:34
epic: e10
---

## What

Auto-commit never commits on Windows: moving a card (to done, or to any other
column) leaves the board dirty forever.

Root cause is in `src-tauri/src/git.rs`, `board_prefix()`. It works out where
`.gello/` sits inside the repo by stripping git's `rev-parse --show-toplevel`
off the canonicalized board path:

- `git rev-parse --show-toplevel` returns `C:/Users/dev/proj` — plain, forward
  slashes.
- `Path::canonicalize()` returns `\\?\C:\Users\dev\proj\.gello` on Windows —
  the extended-length form.

`Path::strip_prefix` compares components, and the verbatim prefix `\\?\C:`
never matches the disk prefix `C:`, so `board_prefix()` returns `None`. From
there `board_changes()` returns `None`, `runAutoCommit` in `App.tsx` hits
`if (!raw) return`, and no commit is ever attempted. On macOS/Linux
`canonicalize` returns a plain path, which is why the bug is invisible here.

The same `None` also makes `worktree_status()` return `None` — that is i0127
(git status not displayed on Windows), same root cause, fixed by the same
change.

Fix: do the prefix comparison on normalized strings instead of `Path`
components — strip `\\?\` / `\\?\UNC\`, unify separators, upper-case the drive
letter — so both spellings of the same directory compare equal.

## Acceptance criteria

- [x] A canonicalized Windows board path (`\\?\C:\…\.gello`) strips against
      git's `C:/…` toplevel and yields the prefix `.gello/`.
- [x] A UNC board path (`\\?\UNC\server\share\proj\.gello` vs
      `//server/share/proj`) strips too.
- [x] Drive-letter case and trailing separators do not defeat the match.
- [x] A sibling directory that shares a name prefix (`/repo-other` under
      `/repo`) is still rejected.
- [x] POSIX paths keep working unchanged, including the macOS symlinked-tempdir
      case the existing tests cover.

## Notes

- The card had no description; the diagnosis above is read off the code. The
  report is taken as the Windows counterpart of i0127, filed in the same
  session: on Windows `board_prefix()` returns `None`, which switches off both
  the dirty indicator (i0127) and auto-commit (this card). Nothing in the
  commit path is status-specific — done is just where the human noticed it.
- The prefix match moved out of `Path::strip_prefix` into a pure string
  comparison (`comparable` / `relative_prefix`). `std::path` gives Windows
  prefix semantics only on Windows, so the bug cannot be reproduced through
  `Path` on macOS; comparing normalized strings makes it testable everywhere.
- i0127 should be fixed by this same change. Left for the human to verify on
  Windows and close.
- The frontend suite has 12 failures at HEAD (c0118/c0120 follow-up trigger,
  demo board, `board.test.ts` WIP limit) — pre-existing, unrelated to this
  card, and tracked by i0130. Rust tests, typecheck and lint are green.

## Log

- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
