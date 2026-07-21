---
id: c008
title: WIP limit warnings
status: done
epic: e02
depends: [c005]
tags: [ui]
created: 2026-07-16
updated: 2026-07-21
status-changed: 2026-07-21T12:33:05
---

## What

Columns with a `wip_limits` entry in board.yaml show count/limit and flag
overruns visually. Soft limit — never blocks a move.

## Acceptance criteria

- [x] Column header shows `n/limit` when a limit is configured
- [x] Overrun state is visually distinct
- [x] No limit configured → no counter noise

## Notes

- `wipState(config, column, count)` in `src/lib/board.ts` is the whole rule:
  null when the column has no `wip_limits` entry, otherwise `{limit, count,
  over}`. `over` is `count > limit`, so a column at exactly its limit is not
  flagged. A limit of `0` is a limit — one card in the column is an overrun.
- The count is the number of cards **visible** in the lane, so it keeps
  agreeing with what the column shows when an epic/type/tag/search filter is
  active. Consequence: a filter can hide an overrun. The alternative —
  counting the whole board — makes the header disagree with the lane it sits
  in. Revisit if hiding the warning turns out to bite.
- Overrun styling is the amber the needs-attention lane already uses, plus a
  `title` naming the limit. Nothing gates a move: the ArrowRight/drag paths
  never consult the limit, covered by a test.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 wipState + column header counter/overrun, tests green
- 2026-07-21 status → review (agent)
- 2026-07-21 status → done (app)
