---
id: c0170
title: 'App: sign-off column + check-list'
status: done
epic: e08
depends: [c0164]
created: 2026-08-08
updated: 2026-08-26
status-changed: 2026-08-26T19:44:59
usage-tokens: 44361
usage-cost: 9.230168
---

## What

Present the `signoff` column ([[c0164]]) as the human's check-list of
AI-reviewed cards awaiting sign-off, and surface the pile size ([[c0161]]). The
human clears it by moving cards `signoff → done` (or reopening to
`review` / `in-progress`). A count/badge makes pending sign-offs visible at a
glance on return; the recorded review verdict is visible on each card.

## Acceptance criteria

- [x] The `signoff` column presents its cards as the sign-off check-list, with
      each card's recorded verdict visible.
- [x] The human can move a card `signoff → done`, and back to
      `review` / `in-progress` to reopen.
- [x] A count/badge shows the number of cards awaiting sign-off.
- [x] Component-tested (cards render in the column; the count reflects them).

## Notes

- **The verdict format moved to `src/lib/review.ts`.** [[c0166]] put the
  `## Review` parser in `companion/review.ts`, but the board reads the same
  entries now, and app code cannot import from `companion/`. The parser and its
  tests are app-side; `companion/review.ts` re-exports them, so [[c0167]] and
  [[c0168]] keep reading the verdict off the module they already use, and the
  skill text and the parser still cannot drift (the companion test still parses
  the documented example).
- The verdict line shows on **any** card carrying one, not only in the sign-off
  column — a fail explains a card that came back to `in-progress`, and the rule
  stays "show what the card records" rather than a per-column special case.
  Reasons ride in the tooltip; the full entry is in the card body, which the
  detail already renders.
- **Sign off → `done`, Reopen → `in-progress`.** Reopening to `review` would
  loop under AFK: the review agent dispatches on `review`, would pass the card
  again and hand it straight back. A human reopening means "this needs more
  work", which is `in-progress` — and a companion-owned card there offers the
  [[c0141]] restart. `review` is still one ArrowLeft or one drag away.
- The two moves come from `signoffMoves(columns)` in board.ts and are filtered
  against the board's own `columns`, so a board configured without `done` or
  `in-progress` is not offered a move to a lane it has not got. Columns are
  data (c0164), and the card front is not the place to assume the lineup.
- The count sits in the title bar next to the AFK switch, not only in the
  column header: an epic or tag filter can take the sign-off column's cards off
  screen, and the pile size is the thing to see on returning. Archived cards
  are out of the count, as they are off the board.
- The demo board's sign-off card gained a `## Review` entry so the demo shows
  the check-list as it really reads (`demo/` is gitignored, so that edit is
  local only).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 implemented (agent): verdict format moved to `src/lib/review.ts`
  (companion re-exports); card fronts show the recorded verdict; sign-off cards
  carry Sign off / Reopen; the title bar reports the pile size. README,
  concept.md, companion README and the demo board updated. 1680 tests,
  typecheck, lint and cargo test green.
- 2026-08-09 status → review (agent)
- 2026-08-09 status → done (app)
- 2026-08-09 status → review (app)
- 2026-08-26 status → done (app)
