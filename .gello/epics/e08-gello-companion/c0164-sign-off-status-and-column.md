---
id: c0164
title: Sign-off status + column
status: backlog
epic: e08
depends: []
created: 2026-08-08
updated: 2026-08-08
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

- [ ] `board.yaml` `columns` includes `signoff` between `review` and `done`.
- [ ] The board renders a `signoff` column in that position.
- [ ] A card can be set to `status: signoff` and parses/loads like any status,
      with `status-changed` handled.
- [ ] Moving `signoff → done` is available to the human (drag/menu) as for
      other columns.
- [ ] Status ordering (by `status-changed`) covers `signoff`.
- [ ] Everywhere statuses are enumerated handles `signoff` (no crash / dropped
      column) — covered by parsing/board tests.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
