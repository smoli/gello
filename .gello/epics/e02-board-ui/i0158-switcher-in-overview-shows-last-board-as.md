---
id: i0158
title: Switcher in overview shows last board as current
status: review
type: issue
ref: c0138
epic: e02
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T11:41:47
usage-tokens: 21508
usage-cost: 2.504049
---
Switching itself does not work properly. Add overview to switcher

## What

With the activity view (c0138) open, Ctrl+Tab listed the projects only: the
board behind the view sat on top tagged "current", and committing it was
treated as "you are already there" — a no-op that left you in the view.
Picking any other project loaded that board *under* the still-open view.

The activity view is a place you switch to, so it is an entry in the switcher:
current while it is open, reachable while it is closed.

## Acceptance criteria

- [x] While the activity view is open it is the first, "current" entry; the
      board behind it is the previous place (one Ctrl+Tab goes back)
- [x] Committing that board closes the view and reloads nothing
- [x] Committing another project closes the view and opens that project
- [x] From a board, the view is an entry that opens it when committed
- [x] The view is never greyed as a missing board, and no existence check runs
      against it
- [x] With no board open the view is not offered (nothing to leave behind)

## Notes

- The entry is a sentinel string in the `items` path list (`"\0activity"`) —
  a NUL cannot appear in a path, so nothing collides. `switcherItems(recent,
  mode)` composes the list; `openSwitcher`/`cycleSwitcher` are untouched.
- Placement while closed: the end of the list, so Ctrl+Shift+Tab reaches it in
  one step. Tracking a real MRU position for the view would need a place-MRU
  beside `recent`, which is persisted and shared with the project menu.
- `commitSwitcher` closes the view before opening a project, and skips the load
  when the target is the board the view was sitting on.
- The switcher's window listeners are registered once, so the view's state and
  its open/close callbacks ride in `overviewRef`, refreshed each render like
  `openProjectRef`.

## Log

- 2026-08-08 status → in-progress (agent)
- 2026-08-08 fixed: activity view is a switcher entry (`switcherItems` +
  `OVERVIEW` sentinel), current while open; committing out of it closes it.
- 2026-08-08 status → review (agent)
