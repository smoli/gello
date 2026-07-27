---
id: c0139
title: Mark startable backlog cards
status: in-progress
epic: e02
depends: []
created: 2026-07-24
updated: 2026-07-27
status-changed: 2026-07-27T19:28:25
---

## What

With a deep dependency graph it is hard to see which backlog cards are actually
ready to work — moving a still-blocked card to `ready` just parks it (the
companion's `depends` gate refuses it, the popexel c0073 trap). Surface the
answer on the board: a backlog card whose dependencies are **all done** is
**startable**, and says so, so you pick from the highlighted set instead of
tracing the graph.

This is the inverse of c0123 (which marks a `ready`/`in-progress` card as
*blocked*) and needs no new logic: `blockersFor(model, card)` already exists
(c0123/c0124). A card is startable when `blockersFor(...).length === 0`.

- Show a quiet **"startable"** treatment on a **backlog** card with no
  remaining blockers — the counterpart to c0123's blocked line, sharing its
  visual language so the two read as one system.
- A backlog card *with* blockers shows nothing new here (c0123 covers the
  blocked case for ready/in-progress; backlog blocked is normal and expected).
- A card with no `depends` at all is trivially startable — do not clutter every
  backlog card; only mark a card that *had* dependencies and has now cleared
  them, so the signal means "its blockers just resolved", not "this card is
  unconstrained". (Open — see Discussion.)

## Acceptance criteria

- [x] A backlog card whose `depends` are all `done` shows a "startable" marker
- [x] A backlog card with any unfinished dependency shows no startable marker
- [x] The marker uses the same status-line/badge language as c0123's blocked
      indicator, so the two are visually consistent
- [x] It is derived from the board model — no companion, no new graph logic
- [x] Cards in statuses other than backlog are unaffected
- [x] The startable predicate is a small, unit-tested helper

## Notes

Foundation for c0140 ("Start next"), which reuses the same startable predicate
to pick the card to advance.

- **The open point (a card with no `depends`) is resolved as the card
  recommended:** not startable. `isStartable` requires `depends.length > 0`, so
  the marker means "its blockers just resolved", not "this card is
  unconstrained" — otherwise every plain backlog card would carry it and the
  signal would be noise. Flag if you'd rather mark unconstrained cards too; it
  is a one-line change (`isStartable`).
- **`blockersFor` could not be used directly** as the card assumed: it is
  status-gated to `ready`/`in-progress` (c0123), so it returns `[]` for a
  backlog card regardless of its deps. The startable check uses the c0125
  `openDependencies` instead — the same dependency rule with no status gate,
  which is the right tool for reasoning about backlog. No new graph logic, as
  required.
- Rendered as a fourth treatment of the shared status line
  (`card-activity-startable`), a quiet green counterpart to c0123's amber
  blocked line. A backlog card never has an activity line, pickup countdown, or
  blocked line (those are ready/in-progress states), so the slot is free and
  the four treatments stay mutually exclusive in practice.

## Log

- 2026-07-24 created from the "picking the right card in a deep graph" design
  discussion (ideas #1 + #4); pairs with c0140.
- 2026-07-27 status → ready (app)
- 2026-07-27 status → in-progress (agent)
- 2026-07-27 isStartable (openDependencies, backlog + had-deps-now-clear) +
  a quiet green "startable" card-front line — 11 tests. Resolved the open
  no-deps point as not-startable, per the card's recommendation.
