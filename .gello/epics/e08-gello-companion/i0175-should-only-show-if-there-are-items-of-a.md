---
id: i0175
title: Should only show if there are items of AFK is active
status: review
type: issue
ref: c0170
epic: e08
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T07:57:43
usage-tokens: 19364
usage-cost: 2.998846
---

## What

The `signoff` column ([[c0164]], presented by [[c0170]]) is in the default
lineup, so every board carries it — including one that never runs an AI review
agent, where it sits empty and takes a lane. It should show only when a card is
waiting in it or AFK mode ([[c0162]]) is on.

## Acceptance criteria

- [x] With AFK off and no card in `signoff`, the board does not render the
      column.
- [x] With AFK on, the column renders even when empty.
- [x] With a card in `signoff`, the column renders whatever AFK says.
- [x] Every other configured column renders as before, empty or not.
- [x] Unit-tested (column selection) and component-tested (board rendering, and
      the toggle bringing the column on).

## Notes

- Read as "…if there are items **or** AFK is active". The title-bar count from
  [[c0170]] already hides at zero, so the column was the surface at issue.
- `visibleColumns(model, afk)` in `board.ts` decides what gets a lane; moves
  keep stepping through `model.config.columns`. A card can be sent to sign-off
  with the column off screen (the review agent does exactly that under AFK), and
  the column appears as soon as one lands there.
- Column visibility counts archived cards, unlike the title-bar pile size: with
  Settings › Show archived on, an archived sign-off card must still have a
  column to render in.
- Visibility is board-wide, not per filter — an epic or tag filter emptying the
  column does not take it off screen mid-work.

## Log

- 2026-08-09 status → in-progress (agent)
- 2026-08-09 implemented (agent): `visibleColumns` in board.ts, `afk` prop on
  Board, wired from App; README and concept.md updated. 1697 tests, typecheck
  and lint green.
- 2026-08-09 status → review (agent)
