---
id: c0163
title: Park-and-skip dispatch in AFK
status: in-progress
epic: e08
depends: [c0162]
created: 2026-08-08
updated: 2026-08-09
status-changed: 2026-08-09T06:56:51
---

## What

Part 1 of AFK ([[c0161]]). Today a parked (`waiting-for-input`) run keeps its
WIP slot and its session ([[c0126]]), so the queue stalls on the first card
that needs a decision. With AFK on, a parked run **frees its WIP slot but keeps
its session hold**, so `planDispatch` dispatches the next non-session-held card
around it. Under `scope: epic` the parked card's epic waits behind it (shared
session); other epics and standalone cards proceed. Under `scope: card` only
the parked card waits. AFK off: unchanged (a parked run holds its slot).

## Acceptance criteria

- [x] AFK off: a parked run holds its WIP slot and its session (current
      behaviour, regression-guarded).
- [x] AFK on: a parked run releases its WIP slot but still holds its session
      key.
- [x] AFK on: `planDispatch` dispatches the next card whose session key is free
      into the freed slot.
- [x] AFK on, `scope: epic`: a parked card's epic waits behind it; other epics
      and standalone cards proceed.
- [x] AFK on, `scope: card`: only the parked card waits.
- [x] Unit-tested with the fake spawner (parked card frees the slot; same-epic
      held; cross-epic proceeds).

## Notes

The whole change is one number: the WIP budget. A parked card is normally
counted twice over — it is `in-progress` on the board *and* has an active run —
so freeing its slot means subtracting it from that union, not removing it from
the active set. Removing it from the active set would have dropped its session
hold too, which is exactly what [[c0161]] decided against.

- `occupiedSlots(model, activeCardIds, slotFreed = [])` — `slotFreed` ids are
  deleted from the union last.
- `planDispatch(..., scope, slotFreed = [])` — a trailing parameter defaulting
  to empty, so every existing caller is unchanged. The freed cards stay in
  `activeCardIds`, which is what seeds the session-held keys: their own key
  stays busy while the budget they released goes elsewhere. Nothing in the
  session gate needed touching — the scope behaviour (epic waits, card doesn't)
  falls out of that.
- `Runner.slotFreed()` — the parked active runs when `isAfk()`, empty otherwise.
  AFK toggled off mid-park takes effect on the next sync, like every other read
  of the flag.
- Parking re-syncs under AFK instead of only publishing, so the freed slot is
  used at once. The park write (the question landing on the card) would wake the
  watcher anyway, but dispatch should not depend on that.

**Resume stays immediate, so a board can sit one run over its limit.** With the
slot given away, an answered park resumes into a full board. Deferring the
resume until a slot frees was rejected: the human is back and their answer would
sit behind an unrelated run. A resume was never budgeted (before AFK a parked
run held its own slot), so this is the one place AFK can exceed the WIP limit —
pinned by a test, and raised as [[i0173]] for a later call.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 park-and-skip implemented: `slotFreed` on `occupiedSlots` /
  `planDispatch`, `Runner.slotFreed()` from the AFK flag, park re-syncs under
  AFK. Documented in companion/README.md; resume overshoot raised as [[i0173]]
