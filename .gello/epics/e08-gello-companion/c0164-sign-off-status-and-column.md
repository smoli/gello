---
id: c0164
title: Sign-off status + column
status: done
epic: e08
depends: []
created: 2026-08-08
updated: 2026-08-09
status-changed: 2026-08-09T07:22:10
usage-tokens: 31813
usage-cost: 6.463612
---

## What

A new board status `signoff` between `review` and `done`, holding AI-reviewed
cards awaiting the human ([[c0161]]). Add it to `board.yaml` (`columns` order +
any status metadata) so it renders as a column in that position. Only a human
moves `signoff → done`; the review agent ([[c0167]]) moves passing cards into
it. This card owns the board-model change; the check-list UX is [[c0170]].

A board-model change touches everywhere statuses are enumerated — the shared
types, `board.yaml` parsing, column rendering, status-change writes
(`status-changed`), and ordering.

## Acceptance criteria

- [x] `board.yaml` `columns` includes `signoff` between `review` and `done`.
- [x] The board renders a `signoff` column in that position.
- [x] A card can be set to `status: signoff` and parses/loads like any status,
      with `status-changed` handled.
- [x] Moving `signoff → done` is available to the human (drag/menu) as for
      other columns.
- [x] Status ordering (by `status-changed`) covers `signoff`.
- [x] Everywhere statuses are enumerated handles `signoff` (no crash / dropped
      column) — covered by parsing/board tests.

## Notes

- Columns are data, not code: the board renders `config.columns`, drag/drop and
  the keyboard move step through that list, and `columnComparator` falls back to
  the `status-changed` rule for any column that is not `discuss`/`backlog`/
  `ready`. So the status itself is three list edits — `DEFAULT_BOARD_CONFIG`
  (the no-board.yaml fallback), the `scaffold.ts` lineup a fresh board is
  written from, and our own `.gello/board.yaml` — plus tests pinning the
  position and the ordering.
- The one place that enumerated statuses by hand was the follow-up action,
  duplicated as `status === "review" || status === "done"` on the card front and
  in the card detail. Both now call `canFollowUp` (board.ts), which includes
  `signoff` — reviewed work is finished work, so a follow-up makes the same
  sense there.
- The demo board (c0114) must fill every column, so it gained a `signoff` card.
- Left out deliberately, carded instead: existing boards keep their own
  `columns:` and so have no `signoff` column ([[c0171]]), and the cross-project
  view still aggregates `review` rather than `signoff` ([[c0172]]).
- Not touched: the companion's dependency gate still counts only `done` — that
  is [[c0165]]. Column presentation and the verdict are [[c0170]].

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-08 status → in-progress (agent)
- 2026-08-08 implemented (agent): `signoff` in the default lineup, the scaffold
  and our own board.yaml; `canFollowUp` replaces the duplicated review/done
  check; README + concept.md updated. 1629 tests, 77 Rust tests, typecheck and
  lint green.
- 2026-08-09 status → review (agent)
- 2026-08-09 status → done (app)
