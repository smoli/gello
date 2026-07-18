---
id: c056
title: Sorting
status: done
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:18:50
milestone: m02
---
So proper sorting definitions

* Inbox: by creation time, oldest on top
* Discuss: by creation time, oldest on top
* Backlog: User can rearrange manually, dragging and dropping, the user can insert
* Ready: as backlog
* In-Progress: By time when the status was assigned, earliest on top
* Review: as in-Progress
* Done: as in-progress

## What

Replace the current board-wide "priority, then id" sort with per-column
rules (spec above). Priority becomes display-only: a badge, and an input
for agents picking work — on the board, urgency is expressed by placement.

Three schema additions carry the data (concept.md §4 to be updated):

1. **`order: <number>`** (optional) — manual position in backlog/ready.
   Fractional ranking: inserting between two cards writes the midpoint to
   the dragged card only — one surgical line edit, no neighbor files
   touched. Cards without `order` sort after ordered ones, by created/id.
2. **`status-changed: <datetime>`** (optional) — written by the app on
   every status change; agents are asked to do the same (CLAUDE.md
   convention). Missing field falls back to `updated` → `created` → id.
3. **`created` may be a full ISO datetime** for new cards (day-only dates
   in existing cards stay valid); ties broken by id, which is allocated
   sequentially anyway.

Column rules: inbox and discuss sort by created (oldest first);
backlog and ready by `order` (drag & drop inserts at the drop position,
with an insertion indicator); in-progress, review, and done by
`status-changed` (earliest first).

Note the inbox/backlog distinction: inbox-folder cards have
`status: backlog` too, but they render in the **inbox column**, which is
strictly creation-ordered — manual ordering exists only in the backlog
and ready **columns** (milestone cards). The inbox is a capture queue,
not a ranking surface; prioritizing happens by triaging out of it.

## Acceptance criteria

- [x] concept.md §4 documents `order`, `status-changed`, and datetime
      `created`; parser round-trips all three (day-only `created` still
      valid)
- [x] Inbox and discuss columns sort by created ascending, id as
      tiebreaker
- [x] Backlog and ready columns sort by `order` ascending; cards without
      `order` come last, by created/id
- [x] The inbox column is never manually orderable: drags within it don't
      reorder, and an `order` field on an inbox card has no effect there
- [x] Dragging within backlog/ready shows an insertion indicator and
      persists the new position as a single surgical `order` write on the
      dragged card only
- [x] Dropping a card *into* backlog/ready (from another column) inserts
      at the drop position; keyboard moves (arrow keys) append at the end
- [x] Every status change through the app writes `status-changed`
      (ISO datetime) on the moved card
- [x] In-progress, review, and done sort by `status-changed` ascending;
      missing field falls back to `updated`, then `created`, then id
- [x] Priority no longer affects any column's order
- [x] New cards get a datetime `created`
- [x] CLAUDE.md board conventions updated: agents set `status-changed`
      when changing a status

## Discussion

- **Priority is display-only now** — the per-column rules replace
  priority-then-id everywhere; backlog/ready ranking *is* the priority
  signal on the board. (Rejected: priority as tiebreaker or as primary in
  temporal columns.)
- **Fractional `order` over integer resequencing or a board.yaml list**:
  one file touched per drag, no watcher churn, no central contested
  state, agent-friendly. Midpoint exhaustion (repeated insertion at the
  same spot) is handled by renumbering the column only when a gap
  underflows — rare, and still just line edits.
- **`status-changed` as frontmatter, not Log parsing**: Log lines are
  free-form prose, too fragile as a data source. Field is optional with a
  graceful fallback chain, so agent-moved cards without it still sort
  reasonably.
- **Datetime `created` going forward**: day-granularity made same-day
  creation order depend on id alone; new cards record time. Existing
  cards are untouched — id tiebreak covers them.
- **Manual order is global per column** (across milestones, matching how
  columns render); the milestone filter just hides cards, it never
  rewrites order.
- **Timestamps are local time, ISO `YYYY-MM-DDTHH:MM:SS`** — sortable
  lexicographically, human-readable in the file, no timezone juggling for
  a local-first tool.

## Notes

- **Schema** (`cards.ts`): `Card.order: number|null` and
  `Card.statusChanged: string|null`; parser rejects non-numeric `order`
  (symmetric with priority/status validation). `CardFieldChanges` carries
  `order`/`statusChanged`; a `null` value now *removes* the frontmatter
  line (new `removeFrontmatterField`) so a stale rank can be cleared
  surgically. `FRONTMATTER_KEYS` maps `statusChanged` → `status-changed`.
  `formatScalar` relaxed so ISO datetimes (`12:30`) stay unquoted plain
  scalars. `newCardRaw` stamps full `created` datetime, date-only
  `updated`.
- **Sorting** (`board.ts`): retired `byPriorityThenId`. `columnComparator`
  dispatches — `byCreatedThenId` (inbox/discuss), `byManualOrder`
  (backlog/ready), `byStatusChanged` with updated→created→id fallback
  (in-progress/review/done and unknown custom columns). `planManualInsert`
  returns a midpoint (single write) or a renumber batch when ranks can't
  express the slot (unranked neighbors / exhausted gap). ISO dates and
  datetimes compare lexicographically, so day-only and timed values mix.
- **Actions** (`board-actions.ts`): status change stamps `status-changed`
  (full local datetime) and clears a stale `order` unless the drop set a
  new one; `moveCard` gained an optional `order`; new `reorderCard`
  (rank-only write, no journal) and `renumberCards`. `nowIsoDateTime`
  computes local time (not UTC `toISOString`), `todayIsoDate` derives from
  it.
- **UI** (`Board.tsx`): manual columns render `InsertZone` elements between
  cards during a drag (indicator via `.insert-zone-active`); drop computes
  the plan, accounting for the dragged card's own slot when moving
  downward. `App.tsx` wires `onReorderCard`/`onRenumber` with optimistic
  update + rollback. Keyboard moves stay unpositioned (unranked tail).
- **Verified** in the running app (mocked Tauri IPC boundary): drag-reorder
  within backlog wrote a single `order: 0` with no status-changed; blue
  insertion indicator rendered; insert zones present in backlog/ready, none
  in in-progress; cross-column drop stamped `status-changed` + fresh
  `order: 10` (not the stale 20); keyboard move to ready cleared `order`
  and stamped `status-changed`. No errors.
- Priority is now display-only everywhere; superseded the c046 test's
  priority-first expectation (updated deliberately, not weakened).
- 240 tests green (was 229); typecheck + lint clean.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): per-column rules confirmed, schema
  additions decided (order, status-changed, datetime created), priority
  demoted to display-only
- 2026-07-17 status → ready (app)
- 2026-07-17 clarified (agent): inbox column is strictly creation-ordered;
  manual ordering is exclusive to the backlog/ready columns
- 2026-07-17 picked up (agent), status → in-progress
- 2026-07-17 implemented TDD across cards/board/board-actions/Board/App
  (25 new tests, 240 green), docs updated, verified in the running app,
  status → review
- 2026-07-17 status → done (app)
