---
id: m01
title: Foundation
status: backlog
---

## Goal

A running Tauri 2 + React/TS skeleton with the test harness wired, plus the
core domain layer: parsing, serializing, and loading the `.gello/` file tree
into a typed board model. No UI beyond a placeholder window.

## Definition of done

- `pnpm test`, `pnpm typecheck`, `cargo test`, and `pnpm tauri dev` all work.
- Card/milestone/board.yaml round-trip (parse → modify → serialize) is fully
  tested, including malformed-frontmatter handling.
- A `.gello/` tree on disk (this repo's own board!) loads into a board model.
- All file writes go through one atomic-write path.
