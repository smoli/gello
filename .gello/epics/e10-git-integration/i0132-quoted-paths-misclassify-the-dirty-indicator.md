---
id: i0132
title: Quoted paths misclassify the dirty indicator
status: in-progress
type: issue
created: 2026-08-05
updated: 2026-08-06
status-changed: 2026-08-06T00:26:12
epic: e10
---

## What

`git status --porcelain` quotes and C-escapes any path it can't print plainly
(`?? ".gello/assets/gru\303\237e/x.png"`). `worktree_status` in
`src-tauri/src/git.rs` compares the raw line against the `.gello/` prefix, so a
quoted board path fails the match and counts as a *code* change: the title-bar
dot renders filled instead of hollow. `board_changes` had it worse — the quoted
spelling names no file on disk, so the card's content came back empty and the
commit message lost it.

Wider than first filed. git quotes three kinds of path, not one:

- a non-ASCII byte — `".gello/c-stra\303\237e.md"`
- **a space** — `".gello/plain name.md"`, which is the likely one in practice
  (assets and hand-named attachments; card filenames are ASCII and unspaced via
  `slugify`)
- ` -> ` in the name — git quotes it precisely so a rename can't be misread,
  which the old `rsplit(" -> ")` rename heuristic then misread anyway

Fix: `-z` rather than `core.quotepath=false`. NUL-terminated records are never
quoted or escaped at all, so all three cases arrive verbatim, and a rename's
original path comes as its own field instead of needing an arrow to be guessed
at. One `porcelain_paths` parser now serves both callers.

## Acceptance criteria

- [x] A board file whose name holds a non-ASCII byte counts as board-dirty, not
      code-dirty.
- [x] A board file whose name holds a space counts as board-dirty.
- [x] A board file whose name holds ` -> ` counts as board-dirty and is listed
      under its full name.
- [x] `board_changes` reports each of those paths verbatim — no quotes, no
      escapes — and reads the file's worktree content.
- [x] A staged rename is reported once, at its new path; a renamed code file
      stays code.
- [x] Existing classification is unchanged: `cargo test` green.

## Notes

- The first version of the non-ASCII test passed against the unfixed code, for
  the wrong reason: inside a wholly-untracked directory git collapses the entry
  to that directory's ASCII name (`?? .gello/inbox/`), so the interesting path
  never appeared in the output. The tests now write at the board root, which the
  fixture leaves tracked.
- `ß` is the non-ASCII character throughout: it has no canonical decomposition,
  so the tests can't trip over APFS NFC/NFD normalization.
- `porcelain_paths` drops the rename/copy original rather than reporting it. For
  the dirty indicator and for auto-commit only the current path matters — the
  commit is a pathspec commit over `.gello`, which stages the deletion of the old
  path regardless.
- Nothing else parses git output; `commit_board` passes pathspecs and never
  reads paths back.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-06 status → in-progress (agent)
- 2026-08-06 found spaces and ` -> ` quote too, not just non-ASCII
- 2026-08-06 `-z` + one porcelain parser for both callers; cargo test 62,
  frontend 1377, typecheck/lint/clippy green
