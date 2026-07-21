---
id: i0117
title: context menu shows two submenus shortly
status: in-progress
type: issue
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T12:39:21
epic: e02
---

When hovering from one entry with a submenu to the next it shows both submenus for a short time. I suspect this is the delay on hiding a submenu so the user can reach the submenu without it disappearing becuase of a gap.

## Acceptance criteria

- [x] Moving from one submenu parent to the next never puts two submenus on
      screen at the same time
- [x] The hover-intent delay still holds: travelling diagonally to an open
      flyout across the item below it does not close it
- [x] With no submenu open, hovering a parent opens it without waiting

## Notes

- The suspicion in the report was right. Each `MenuItem` owned its own
  `openSub` plus its own close timer, so the item being left waited out its
  250 ms while the item being entered opened at once.
- Fix: the open submenu is now state of the menu *level* (`MenuList`), one
  label and one timer per level. Closing the old and opening the new is a
  single state change, so there is no window where both are mounted. Nested
  levels each get their own `MenuList`, so a third level behaves the same.
- Consequence: switching between two sibling submenus takes the hover-intent
  delay before the new one appears, instead of appearing instantly. That is
  what buys the diagonal travel — pointing at the item below the flyout does
  nothing for 250 ms, and reaching the flyout cancels it. Opening the first
  submenu is still instant (nothing to swap out).

## Log

- 2026-07-21 status → backlog (app)
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 open submenu lifted to the menu level, reproducing test first
