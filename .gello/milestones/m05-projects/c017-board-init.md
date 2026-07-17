---
id: c017
title: Initialize a board in a fresh repo
status: done
milestone: m05
priority: normal
depends: [c016]
tags: [core]
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T10:44:10
---

## What

Scaffold `.gello/` (board.yaml, empty concept.md, inbox/, milestones/,
assets/) in a repo that has none, and offer to append the agent-workflow
convention snippet to the repo's CLAUDE.md (create if absent).

## Acceptance criteria

- [x] Scaffold matches the layout in concept.md §4
- [x] Existing CLAUDE.md is appended to, never overwritten
- [x] Existing `.gello/` is never touched by init
- [x] Freshly initialized board renders immediately

## Notes

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Pure `scaffold.ts`: `scaffoldFiles(projectRoot)` (board.yaml + concept.md +
  inbox/assets/milestones .gitkeeps) and `claudeMdContent` (create if absent,
  append the marked convention block if present, idempotent — never twice).
  5 tests + a real-filesystem smoke test.
- Rust `write_new_files` creates parent dirs then atomic-writes each file
  (atomic_write alone requires an existing dir). board-io `initBoard` composes
  the scaffold + CLAUDE.md and calls it.
- App: opening a folder with no `.gello` now shows an "Initialize board?"
  prompt (fills the c016 no-board gap); Initialize scaffolds then re-opens →
  the fresh board renders immediately. "Existing `.gello/` never touched" holds
  by gating: init is only offered when the picker finds no board root.
- The convention snippet is compact and self-contained (query recipes +
  pick-up/finish/new-idea rules) so a fresh repo's agent can work the board.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 status → ready (app)
- 2026-07-17 scaffold + CLAUDE.md convention + init prompt, 6 tests, status → review
