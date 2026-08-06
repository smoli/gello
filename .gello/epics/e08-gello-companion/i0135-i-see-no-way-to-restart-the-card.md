---
id: i0135
title: I see no way to restart the card
status: in-progress
type: issue
ref: c0141
epic: e08
created: 2026-08-06
updated: 2026-08-06
status-changed: 2026-08-06T06:01:20
---

Only way I see is dragging it back to ready. Add a button to restart it to the card front and detail

## Investigation & fix (agent, 2026-08-06)

The card front restart button (c0141) exists but wasn't showing, for two reasons:

- **`owned` was absent from the live `state.json`** — the running companion
  predated c0141, so it published no owned set at all; `isStoppedCard` then can't
  identify a restartable card. (Operational: that companion needs restarting to
  pick up the code — the recurring long-running-process gap.)
- **Even a fresh companion had a real gap**: c0141 tracked ownership only in
  memory (plus `card:`-session recovery), so under the **default epic scope** a
  stopped card stopped being restartable the moment the companion restarted —
  the epic session key names no single card, so nothing recovered it.

Fixed both the durability gap and the missing surface:

- **Persist ownership** to `.companion/owned.json` (beside `sessions.json`).
  The runner seeds `owned` from it at startup and rewrites it when it first runs
  a new card, so ownership survives a restart under **any** scope. Smoke-tested:
  a companion seeded from the file republishes `owned` in `state.json`.
- **Restart in the detail view** too, not only the card front: a Restart button
  in the detail actions, gated by the same `isStoppedCard`. The front's small
  hover line was easy to miss — this is the discoverable surface the card asked
  for.

**Note for the reporter**: the running companion must be restarted once to pick
up this build; after that a stopped card stays restartable across future
companion restarts, and the Restart button is on both the card front and detail.

## Log

- 2026-08-06 status → in-progress (agent)
- 2026-08-06 (agent) fixed: persist companion card ownership to
  `.companion/owned.json` (so restart survives a companion restart under epic
  scope) and add a Restart action to the card detail view. 1393 tests,
  typecheck, lint and a bundle build green.
