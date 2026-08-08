---
id: c0154
title: Auto-Commiting should be default
status: review
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T06:35:25
epic: e10
---

When gello detects upon onboarding that the project is a git repo, auto-commit should be on by default

## Acceptance criteria

- [x] Opening a project with no stored auto-commit choice turns auto-commit on
      when git reports the project is a repo, and records `auto-commit:<path>`
      as `1`.
- [x] A stored `0` keeps auto-commit off — the default never overrides a choice
      the human made.
- [x] A project that is not a git repo stays off, and nothing is recorded.
- [x] A repo git cannot read (`unavailable`) stays off — an unanswered `git
      status` is not a detected repo.

## Notes

- "Onboarding" = the first time gello opens a project, which is the state where
  the per-project flag `auto-commit:<project path>` is unset. There is no
  separate onboarding step to hook into.
- The default is written back as `1` rather than left implicit, so the flag
  reads as the project's setting from then on. Nothing is written for the
  not-a-repo and `unavailable` cases, so a later `git init` still picks the
  default up on the next open.

## Log

- 2026-08-08 status → ready (app)
- 2026-08-08 status → in-progress (agent)
- 2026-08-08 status → review (agent)
