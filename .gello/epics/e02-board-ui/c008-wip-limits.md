---
id: c008
title: WIP limit warnings
status: in-progress
epic: e02
depends: [c005]
tags: [ui]
created: 2026-07-16
updated: 2026-07-21
status-changed: 2026-07-21T12:23:23
---

## What

Columns with a `wip_limits` entry in board.yaml show count/limit and flag
overruns visually. Soft limit — never blocks a move.

## Acceptance criteria

- [ ] Column header shows `n/limit` when a limit is configured
- [ ] Overrun state is visually distinct
- [ ] No limit configured → no counter noise

## Notes

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
