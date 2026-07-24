---
id: c0135
title: Board-graph context in the pack
status: backlog
epic: e09
depends: [c0134]
created: 2026-07-24
updated: 2026-07-24
---

## What

Fill the context pack (c0134) with the card's place in the board — the cheapest
context to produce and the highest-value, because it is exactly what a cold
agent wastes turns rediscovering. All of it is derived from the board model; no
human input and no repo scan.

Sections added to the pack:

- **Depends on** — each `depends` card by id + title + status, and for a `done`
  dependency a one-line outcome pulled from its card (so the agent knows what it
  builds on, not just that it exists).
- **Related** — the card's `ref`/follow-up links (the c0115/c0118 provenance).
- **Siblings** — the other cards in this epic and their statuses, so the agent
  sees the surrounding effort.
- **Epic** — the epic Goal and Definition of done (beyond the bare Goal the
  minimal pack already carries).

Each section respects c0134's size budget; sibling and outcome text truncate
first when space is tight.

## Acceptance criteria

- [ ] The pack lists the card's `depends` with id, title, status, and a
      one-line outcome for `done` ones
- [ ] The pack lists the card's `ref`/follow-up relations
- [ ] The pack lists the epic's other cards with their statuses
- [ ] The pack includes the epic Goal and Definition of done
- [ ] A dependency id that resolves to no card is shown as missing, not omitted
- [ ] All of it is derived from the board model — no repo or git access
- [ ] Each section honours the c0134 budget and truncates gracefully
- [ ] Unit-tested against a fixture board (relations, outcomes, truncation)

## Notes

Smallest-shippable-slice partner of c0134: together they deliver useful context
with zero human effort. Reuses the same relation logic the app shows in the
card detail (c0124 dependencies, c0115 follow-ups) — board-derivable facts,
now handed to the agent instead of only the human.

## Log

- 2026-07-24 created from the e09 epic breakdown
