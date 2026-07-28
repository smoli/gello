---
id: c0140
title: "Start next — advance the dependency frontier"
status: in-progress
epic: e02
depends: [c0139]
created: 2026-07-24
updated: 2026-07-28
status-changed: 2026-07-28T08:34:50
---

## What

Remove the decision entirely when you just want to move forward: a **Start
next** action that moves the top **startable** backlog card to `ready` in one
click. The app knows the graph, so you should not have to hand-pick the right
card from a deep tree.

"Top startable" = a backlog card with no remaining blockers (the c0139
predicate), chosen by the board's manual `order` (c056), so the same rule that
orders the backlog decides what advances next. It moves exactly one card, so
`ready` stays your deliberate "spend on this now" gate (c0115/c0117) — this is a
faster way to open the gate, not a way to bypass it.

- **Scope:** the current epic filter if one is active, else the whole board —
  advance the frontier of what you are looking at.
- **Nothing startable:** the action is disabled/absent, with the reason
  available (everything is blocked, or the backlog is empty).
- It performs a normal status move (`backlog` → `ready`, stamping
  `status-changed`), so the companion's grace period (c0117) and everything
  downstream behave exactly as a manual drag would.

## Acceptance criteria

- [ ] A "Start next" action moves the top startable backlog card to `ready`
- [ ] "Top" respects the manual `order`; among equal/unordered cards the tie is
      broken deterministically
- [ ] A card with unfinished dependencies is never chosen
- [ ] With an epic filter active, only that epic's cards are considered
- [ ] When nothing is startable, the action is unavailable and says why
- [ ] The move is an ordinary status change (stamps `status-changed`), so c0117
      and dispatch behave as with a manual move
- [ ] The selection ("which card is next") is a pure, unit-tested function

## Notes

Reuses c0139's startable predicate; the only new piece is the selection (order
the startable set, take the first) and the button that fires the existing
move-card path. Deliberately advances **one** card so the `ready` gate keeps its
meaning — this is idea #4 from the design discussion, not the #6 "trigger on
backlog" auto-drive (that is a separate workflow choice).

## Log

- 2026-07-24 created from the "picking the right card in a deep graph" design
  discussion (ideas #1 + #4); depends on c0139's startable predicate.
- 2026-07-27 status → ready (app)
- 2026-07-27 status → in-progress (agent)
- 2026-07-28 status → ready (app)
- 2026-07-28 status → in-progress (agent)
