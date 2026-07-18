---
id: c010
title: Inline body editing
status: done
milestone: m03
depends: [c009]
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Edit the card body in place (plain Markdown textarea or light editor). Save on
blur/⌘S. Never hold unsaved state longer than the active edit — the watcher
may bring external changes.

## Acceptance criteria

- [x] Edit → save persists body, frontmatter untouched
- [x] Escape cancels, restoring the on-disk content
- [x] External file change during an active edit is surfaced, not clobbered

## Notes

- Edit button in the detail header swaps rendered Markdown for a monospace
  textarea. Save via button or ⌘S/Ctrl+S; Escape cancels the edit (draft
  dropped, dialog stays open — Escape propagation stopped). Deviation from
  the What-text: **no save-on-blur** — blur-saves fire on any focus change
  (e.g. clicking Cancel) and make accidental writes; explicit save only.
- **Conflict policy (pre-watcher, full policy = c015)**: compare-at-save.
  Before writing, the file is re-read (new Rust `read_file` command +
  `readFileRaw` bridge) and diffed against the raw the edit was based on.
  Mismatch → amber conflict banner, draft untouched, write blocked; the
  model is refreshed from disk so "Discard my edit" reveals the newer disk
  version. "Overwrite" is an explicit second decision (force=true).
- Persistence via existing saveCardBody → replaceCardBody → atomic write:
  frontmatter block byte-identical except the `updated` bump.
- 12 new tests (2 Rust, 2 board-io, 6 CardDetail, 2 App incl. the
  agent-rewrote-the-file-mid-edit scenario). Suite crossed 100.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 12 tests (red → green), conflict flow verified both ways, status → review
