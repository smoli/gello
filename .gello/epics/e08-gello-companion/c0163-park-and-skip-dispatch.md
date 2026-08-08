---
id: c0163
title: Park-and-skip dispatch in AFK
status: backlog
epic: e08
depends: [c0162]
created: 2026-08-08
updated: 2026-08-08
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

- [ ] AFK off: a parked run holds its WIP slot and its session (current
      behaviour, regression-guarded).
- [ ] AFK on: a parked run releases its WIP slot but still holds its session
      key.
- [ ] AFK on: `planDispatch` dispatches the next card whose session key is free
      into the freed slot.
- [ ] AFK on, `scope: epic`: a parked card's epic waits behind it; other epics
      and standalone cards proceed.
- [ ] AFK on, `scope: card`: only the parked card waits.
- [ ] Unit-tested with the fake spawner (parked card frees the slot; same-epic
      held; cross-epic proceeds).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
