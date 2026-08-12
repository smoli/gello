---
id: i0176
title: get this issue fairly often with rust based proejcts
status: done
type: issue
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T21:50:17
epic: e10
usage-tokens: 10382
usage-cost: 1.674671
---

![image](../../assets/i0176/image.png)

## What

Auto-commit ran the project's commit hooks. A board commit holds `.gello/`
markdown only, so a hook that checks the working tree — the fmt/clippy/test
guards common in Rust projects — rejects it whenever a code edit is unstaged,
and the board move surfaces as an error banner.

## Acceptance criteria

- [x] A board auto-commit succeeds in a repo whose `pre-commit` hook rejects
      the commit, and the hook does not run.
- [x] The commit still contains board files only; staged code stays uncommitted.

## Notes

- No criteria were on the card (screenshot only). Read as: the board commit is
  gello's own bookkeeping, so it should not be subject to the project's code
  hooks. `commit_board` passes `--no-verify`, which covers `commit-msg` too —
  gello's generated message follows no project convention either.
- Not made a setting: a hook that wants to run over a `.gello/`-only pathspec
  commit is hard to construct, and auto-commit is on by default in every repo
  (c0154), so the failure would be the common case.
- The `git add` step never ran hooks, so staging was never the problem.

## Log

- 2026-08-09 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 status → review (agent)
- 2026-08-09 status → done (app)
