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

- [x] A "Start next" action moves the top startable backlog card to `ready`
- [x] "Top" respects the manual `order`; among equal/unordered cards the tie is
      broken deterministically
- [x] A card with unfinished dependencies is never chosen
- [x] With an epic filter active, only that epic's cards are considered
- [x] When nothing is startable, the action is unavailable and says why
- [x] The move is an ordinary status change (stamps `status-changed`), so c0117
      and dispatch behave as with a manual move
- [x] The selection ("which card is next") is a pure, unit-tested function

## Notes

Reuses c0139's startable predicate; the only new piece is the selection (order
the startable set, take the first) and the button that fires the existing
move-card path. Deliberately advances **one** card so the `ready` gate keeps its
meaning — this is idea #4 from the design discussion, not the #6 "trigger on
backlog" auto-drive (that is a separate workflow choice).

- **Selection uses c0139's `isStartable` exactly**, not a broader "any backlog
  card with no open deps". This keeps the button and the board consistent: it
  advances one of the cards visibly marked *startable*, never an unmarked one.
  The consequence — a backlog of only plain, dependency-free cards leaves
  "Start next" disabled — is intended: those cards were never the frontier this
  action is for; pick them by hand. Flag if you'd rather it advance any
  unblocked backlog card (a one-line change to the predicate it filters on).
- `nextStartable(model, candidates)` is the pure selection: filter to startable,
  sort by `columnComparator("backlog")` (the same manual-order rule c056 uses),
  take the first. Ordered cards rank before unordered, ties by created/id — so
  the choice is deterministic.
- **Scope is the epic filter only** (`byEpic`), not the type/tag/search filters:
  "advance the frontier of the epic you are on", per the card. The button reuses
  `onMoveCard(card, "ready")` — the exact call a drop-on-column makes — so the
  move stamps `status-changed` and c0117/dispatch behave identically; no App
  change was needed.
- The disabled reason rides in the button's `title` (empty backlog vs nothing
  startable); the visible label stays "Start next".

## Log

- 2026-07-24 created from the "picking the right card in a deep graph" design
  discussion (ideas #1 + #4); depends on c0139's startable predicate.
- 2026-07-27 status → ready (app)
- 2026-07-27 status → in-progress (agent)
- 2026-07-28 status → ready (app)
- 2026-07-28 status → in-progress (agent)
- 2026-07-28 nextStartable (pure selection, manual order) + a "Start next"
  toolbar button firing the existing move path — 8 tests. Reuses c0139's
  isStartable so the button advances a visibly-marked card.
