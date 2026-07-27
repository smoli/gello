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

- [ ] A backlog card whose `depends` are all `done` shows a "startable" marker
- [ ] A backlog card with any unfinished dependency shows no startable marker
- [ ] The marker uses the same status-line/badge language as c0123's blocked
      indicator, so the two are visually consistent
- [ ] It is derived from the board model via `blockersFor` — no companion, no
      new graph logic
- [ ] Cards in statuses other than backlog are unaffected
- [ ] The startable predicate is a small, unit-tested helper

## Notes

Foundation for c0140 ("Start next"), which reuses the same startable predicate
to pick the card to advance.

## Log

- 2026-07-24 created from the "picking the right card in a deep graph" design
  discussion (ideas #1 + #4); pairs with c0140.
- 2026-07-27 status → ready (app)
- 2026-07-27 status → in-progress (agent)
