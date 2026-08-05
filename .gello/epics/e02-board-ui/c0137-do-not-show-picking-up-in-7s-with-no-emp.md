---
id: c0137
title: Do not show picking up in 7s with no empty WIP slot
status: in-progress
created: 2026-07-24
updated: 2026-08-05
status-changed: 2026-08-05T12:10:58
epic: e02
---

If there are no open WIP slots then do. not show the countdown for new „ready“-cards. Instead show that it is waiting on a slot.

## Acceptance criteria

- [x] A queued ready card shows no pickup countdown when every WIP slot is taken
- [x] It shows a "waiting on a slot" line in the countdown's place instead
- [x] With a free slot (or no WIP limit configured), the countdown behaves as
      before
- [x] "Slot free" is the board fact `in-progress count < wip_limits.in-progress`,
      board-wide, unlimited when unset
- [x] The suppression and the new line are pure, unit-tested predicates

## Notes

- Same shape as the c0125 `blocked` fix: `pickupCountdown` gains a `slotFree`
  board fact (default true, so existing callers are unchanged) and returns null
  when no slot is free. A sibling predicate `waitingForSlot` drives the new
  line — true for a queued, non-blocked, non-running ready card with no free
  slot. `blocked` takes precedence (a blocked card waits on its dependency, not
  a slot), and `waitingForSlot` is independent of the grace period, so it also
  covers `pickupDelay: 0` with a full WIP (previously silent).
- `slotFree` is computed once, board-wide, in `collectStatusCards`
  (`hasFreeWipSlot`): `in-progress` card count vs `wip_limits["in-progress"]`,
  unlimited when unset. Board-wide because the companion dispatches board-wide
  and gates on the in-progress count (c0097) — it counts human-moved
  in-progress cards too, which this mirrors.
- The line reuses the `card-activity-pending` treatment (the countdown's look),
  so the two live states read as one system.

## Log

- 2026-07-24 status → ready (app)
- 2026-07-24 status → backlog (app)
- 2026-07-30 status → ready (app)
- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 slotFree board fact suppresses the countdown when WIP is full;
  waitingForSlot drives a "waiting on a slot" line — 11 tests
