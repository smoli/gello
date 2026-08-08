---
id: c0157
title: Show dependencies on cards
status: done
ref: c0138
epic: e02
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T12:22:18
usage-tokens: 14635
usage-cost: 2.834859
---

Multi does not show card dependencies. Hard to understand why card is not queued

## What

The cross-project view (c0138) shows a card's project, id, needs-input badge and
title — nothing about `depends`. A ready card held back by an open dependency
looks the same as one about to be picked up, so there is no way to tell why it
sits there. The board front already names the unfinished dependencies (c0123);
the multi front should say the same thing.

## Acceptance criteria

- [x] A card in the multi view whose `depends` are not all `done` shows
      "waiting on …", naming the open ones
- [x] A card whose dependencies have all cleared shows no such line
- [x] A dependency no card carries is marked `(missing)`
- [x] Dependencies resolve against the card's own project — an id that exists
      only on another board counts as missing
- [x] Clicking a named dependency opens that card's detail in its project
- [x] The line is the board's line, phrased and styled the same way

## Notes

- The blocked line's text and class were inline in `cardStatusLine`, which needs
  a companion state the multi view never reads. Extracted as
  `blockedStatusLine(blockers)` in `card-status.ts`; `cardStatusLine` calls it,
  and the multi front calls it with `blockersFor(board.model, card)` alone. One
  phrasing, two callers, no companion state in the cross-project path.
- `blockersFor` only speaks in `ready` / `in-progress` (c0123), so a `review`
  card with an open dependency stays quiet here too — the multi columns are
  ready / in-progress / review.
- Rendering goes through `CardStatusLine`, so the named ids are the same links
  as on the board. `onOpenBlocker` maps the id to a `(project, id)` key against
  the card's own board — the id alone would be ambiguous across projects.
- Board.css owns the `.card-activity` treatments; MultiProject.css adds only the
  line's spacing.

## Log

- 2026-08-08 status → in-progress (agent)
- 2026-08-08 built: `blockedStatusLine` extracted in card-status.ts, the multi
  card front renders it through CardStatusLine with per-project blocker links.
- 2026-08-08 status → review (agent)
- 2026-08-08 status → done (app)
