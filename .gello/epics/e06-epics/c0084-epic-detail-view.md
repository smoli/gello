---
id: c0084
title: Epic detail view (goal / DoD editor + child rollup)
status: done
type: task
created: 2026-07-18
updated: 2026-07-29
epic: e06
depends: [i0028]
status-changed: 2026-07-29T08:32:38
---

## What

The full epic detail view — the CardDetail-sized sub-piece split out of
[[i0028]] (which ships a minimal stub). Opened by selecting an epic (group
header / filter), it edits `epic.md` and rolls up the epic's child cards.

- **Goal / Definition of done editor** — edit the epic's `## Goal` and
  `## Definition of done` sections with the same surgical, watcher-safe write
  discipline as CardDetail (rebase-on-disk per c015).
- **Epic frontmatter** — title + `status` editable.
- **Child-card rollup** — list the epic's cards grouped by status with a
  count / progress summary; click a child to open its CardDetail.
- **Consistent chrome** — dialog styling, Escape to close, live reconcile.

## Acceptance criteria

- [x] Selecting an epic opens the detail view (replaces i0028's minimal stub)
- [x] Goal and Definition of done are editable and persist surgically to
      `epic.md`, merging with external edits (c015)
- [x] Title and status are editable
- [x] The view lists the epic's child cards grouped by status with a rollup
      count; clicking one opens its CardDetail
- [x] External changes to `epic.md` or its cards reconcile live

## Notes

Split from i0028 per the human's scope call (2026-07-18): creation ships the
minimal view; this card builds the real one.

- **Section editors, not one body textarea.** The card names Goal and
  Definition of done, so each gets its own labelled textarea over a surgical
  section replacement (`readSection` / `replaceSection` in `markdown.ts`).
  Anything else in `epic.md` — a `## Plan` from gello-plan — is preserved and
  still rendered read-only below.
- **Opening an epic**: the board is grouped by status, so there was no epic
  group header to click. Narrowing the toolbar's epic filter to one epic now
  reveals an ⓘ button that opens its detail.
- **No `updated` on an epic**: epic frontmatter is id/title/status
  (concept.md §4), so `updateEpicFields` bumps nothing. An epic status change
  also writes no Log line — epics have no `## Log` by convention.
- **Archived cards are out of the rollup** (c018), so the counts read as live
  work; a fully archived epic shows as empty.
- Pre-existing failures on `main`, unrelated to this card and untouched by it:
  the c0118 follow-up-trigger tests in `Board.test.tsx` / `App.test.tsx` (a
  card front now renders two buttons with the same `Follow up on <id>` label,
  so the queries are ambiguous) and one `demo/holzhof-board.test.ts` case.

## Log

- 2026-07-18 created (agent): split out of i0028 as its dependency-inverse —
  i0028 ships epic creation + a minimal view; this replaces the stub with the
  full editor + child rollup.
- 2026-07-28 status → ready (app)
- 2026-07-28 status → in-progress (agent)
- 2026-07-28 implemented (agent): `readSection`/`replaceSection` (markdown.ts),
  `updateEpicFields`/`replaceEpicBody` (cards.ts), `saveEpicEdit`/
  `saveEpicFields` (board-actions.ts), `withUpdatedEpic` (board.ts), the full
  EpicDetail (editor + status + grouped rollup), the board's open-epic button,
  and the App wiring with the c015 conflict check
- 2026-07-28 status → review (agent)
- 2026-07-29 status → done (app)
