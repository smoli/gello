---
id: c006
title: Drag & drop persists status to frontmatter
status: review
milestone: m02
priority: high
depends: [c004, c005]
tags: [ui, core]
created: 2026-07-16
updated: 2026-07-16
---

## What

Dragging a card to another column updates its `status` frontmatter field via
the atomic write layer. Optimistic UI, rollback on write failure.

## Acceptance criteria

- [x] Drop updates `status` (and `updated`) in the file, nothing else changes
- [x] Write lands within 100 ms of drop
- [x] Failed write rolls the card back and surfaces an error
- [x] Keyboard alternative exists (move card via menu/shortcut)

## Notes

- **Native HTML5 drag & drop, no library** (deviation from concept's
  @dnd-kit suggestion): the board has no within-column sorting — order is
  priority-derived — so "drop card on column" is the entire problem. Zero
  deps, testable with fireEvent in jsdom.
- **Tauri gotcha found by manual testing, invisible to jsdom**: the window's
  `dragDropEnabled` (default true) intercepts native drag events on macOS and
  silently kills HTML5 DnD in the webview. Fixed via `dragDropEnabled: false`
  in tauri.conf.json. Relevant for c011: with interception off, OS file drops
  arrive as standard HTML5 `DataTransfer.files`.
- `moveCard` (board-actions.ts) computes the surgical edit synchronously and
  starts the atomic write immediately (no debounce → the 100 ms criterion is
  met by construction); returns the updated card for optimistic UI plus a
  `persisted` promise that rejects for rollback. Illegal target status throws
  before any write.
- App owns optimistic-update/rollback + `role="alert"` error banner (both
  paths tested); Board stays presentational via `onMoveCard`.
- Keyboard: cards are focusable, ←/→ moves one column; edges are no-ops.
- `board-io` now returns `{root, model}` — writes need absolute paths.
- ESLint self-bite: bare-`fs` glob pattern matched our own relative `./fs`
  import; bans now use exact names for bare modules, globs for node: only.
- Verified live: user drag persisted `backlog → ready` on c020 as a
  one-line diff.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 13 new tests (red → green); real-window test caught dragDropEnabled interception; status → review
