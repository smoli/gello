---
id: i0116
title: Switching between boards keeps filter
status: in-progress
type: issue
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T00:22:39
epic: e01
---

If I filter in board A on epic Y and then switch to board B the board stays filtered on epic Y, which does not exist on board B and therefore renders an empty board

## Notes

- Cause: the toolbar filters (epic, type, tags) are `useState` inside the
  `Board` component. `App` swaps `board` on a project switch but keeps the same
  `Board` instance, so its filter state carries over. An epic folder from board
  A matches nothing on board B → empty board.
- Fix: `key={board.root}` on `<Board>` — a project switch remounts it, resetting
  all toolbar filters to their defaults. Same remount-to-reset pattern already
  used for `CardDetail` (keyed per card path).
- Test: `App.test.tsx` "i0116: switching to another board resets the epic
  filter" — filter board A on its epic, switch to a board without that epic via
  the project menu, assert the new board's card is visible.

## Acceptance criteria

- [x] Switching to another board clears a filter that referenced the previous
  board's epic; the new board is not left empty.

## Log

- 2026-07-21 status → backlog (app)
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
