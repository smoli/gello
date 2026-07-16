---
id: c005
title: Kanban view (read-only) with milestone filter
status: review
milestone: m02
priority: high
depends: [c003]
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Render the BoardModel as a Kanban board: columns from board.yaml, cards
grouped by status, card fronts showing title, id, milestone, priority, and
tags. Filter (or swimlanes) by milestone.

## Acceptance criteria

- [x] Columns render from board.yaml config, in order
- [x] Cards appear in the column matching their status
- [x] Milestone filter narrows the board; "all" shows everything
- [x] Card front shows id, title, milestone, priority
- [x] Empty columns and empty board render sensibly

## Notes

- Scope addition (no card covered disk reading): Rust `fs_read` module —
  `read_board_files` (recursive walk, .md/.yaml only, sorted relative paths)
  and `find_board_root` (walk up from cwd looking for `.gello/`), both
  test-driven (6 tests). Commands registered; `src/lib/board-io.ts` bridges
  them into the pure `loadBoard()`. Outside Tauri (plain browser) the invoke
  bridge is missing → returns null → "No board loaded" placeholder.
- Components: Board (owns the milestone filter state), Column, CardFront in
  src/components/. Cards keep loadBoard's priority-then-id order. Inbox cards
  appear on the board with an `inbox` badge and have their own filter option.
- Filter is keyed by milestone *folder*; label prefers milestone.md title.
- Test-infra fix uncovered by the component tests: RTL auto-cleanup doesn't
  run with vitest globals off — explicit `afterEach(cleanup)` added to
  src/test/setup.ts.
- Empty columns render header + 0 count (never hidden); fully empty board
  renders all configured columns.
- Verified in the running app against this repo's own board.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 6 Rust + 13 frontend tests (red → green), rendered live, status → review
