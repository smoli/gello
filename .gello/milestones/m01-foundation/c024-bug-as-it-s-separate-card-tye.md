---
id: c024
title: Bug as a separate card type
status: done
created: 2026-07-16
updated: 2026-07-16
milestone: m01
---

## What

Introduce a card `type` as an optional frontmatter field with an open value
set defined in `board.yaml` (like columns). Absent `type` means `task`, so
every existing card stays valid; `bug` ships as the first additional type.

Bugs are ordinary cards (same folders, same statuses) with two additions:

1. **Optional reference** — a bug may carry `ref: <card-id>` pointing at the
   card (task or bug) it was found in. A bug can also exist with no
   reference.
2. **Creation flow** — a bug can be created standalone (lands in inbox) by hitting CMD/CTRL+B so it is separate from the quick creation, or
   directly from the detail view of a card in `review` or `done`
   ("report bug"): the new bug lands in that card's milestone with
   `status: backlog` and `ref` pre-filled.

The board shows a type badge on card fronts and in detail, and gains a type
filter next to the milestone filter. The detail view of a referenced card
lists open bugs pointing at it (computed at render time — nothing is
written into the referenced card's file).

## Acceptance criteria

- [x] concept.md §4 documents `type` (optional, default `task`, allowed
      values from `board.yaml`) and `ref` (optional card ID)
- [x] `board.yaml` defines the type set; boards without a `types` key
      default to `[task, bug]`
- [x] Parser: absent `type` → `task`; a type not in the configured set →
      needs-attention lane (symmetric with unknown status)
- [x] `ref` parses as a single card ID; a dangling ref (no such card on the
      board) renders a visible warning on the bug card but the card stays
      valid
- [x] Frontmatter round-trip: setting/changing `type` or `ref` is a
      surgical line edit; all other lines survive byte-for-byte (newCardRaw
      writes them at creation; the surgical-edit machinery is field-generic)
- [x] Card front + detail show a type badge for non-`task` types
- [x] Board toolbar gains a type filter alongside the milestone filter
- [x] "Report bug" action in card detail for cards in `review` or `done`
      creates a bug in the same milestone, `status: backlog`, `ref` set to
      the source card, and opens it
- [x] Standalone bug creation (no ref) lands the card in inbox
- [x] Bug detail renders `ref` as a link that opens the referenced card;
      referenced card's detail lists open bugs pointing at it

## Discussion

- **`type` as an open set in board.yaml, not a hardcoded enum**: the next
  type (chore, spike, …) becomes config, not a schema change. Default
  `task` keeps every existing card valid. (Rejected: `tags: [bug]`
  convention — no way to hang behavior like refs/creation flow off a tag;
  rejected: hardcoded `task | bug`.)
- **`ref` is provenance, not a dependency**: `depends` blocks workflow;
  `ref` records "found in". Single optional value, distinct field.
- **Bugs live wherever cards live**: no separate bugs/ folder — type is
  orthogonal to location. A bug reported against card X belongs to the
  work it broke, hence X's milestone; unanchored bugs go to inbox.
- **Backlinks are computed, never written**: the referenced card's file is
  untouched; its detail view derives "open bugs against me" from the board
  model. Card files stay single-owner.
- **Validation: warn on dangling ref, don't invalidate** — cards get
  deleted by agents/humans; a stale ref shouldn't knock a bug off the
  board. Unknown *type* does invalidate, matching unknown-status handling.
- **No bug template / pre-seeded repro-test AC** — considered and not
  wanted; bug bodies stay free-form.
- **Overlap with c021 (create cards in app)**: this card includes the bug
  creation flows; c021's generic creation should share the same mechanism
  (ID allocation, file placement). Coordinate whichever lands first.
- **Open**: should "report bug" also be offered on cards in other statuses
  (in-progress?), or strictly review/done; badge styling for future
  board.yaml-defined types the app doesn't know (generic badge from the
  type string?).

## Notes

- Data model: `Card.type` (default "task") + `Card.ref`; `BoardConfig.types`
  (default [task, bug]); unknown type → invalid, mirroring unknown status.
  `newCardRaw` takes options {type, ref, milestone}.
- Helpers: `findCardById` + `openBugsFor` (type bug, ref match, status ≠
  done) — computed at render, referenced card's file untouched, as decided.
- Creation: ⌘B opens quick capture in bug mode (form header says "New bug",
  same speed); "Report bug" button on review/done detail → `createBugFor`:
  bug born next to its source (same folder/milestone), `ref` pre-filled,
  title "Bug in <id>", detail opens on the fresh bug (c025's title editing
  makes renaming immediate).
- Open decisions resolved during implementation: unknown-to-the-app types
  get a generic badge from the type string (bug additionally gets its own
  color); report-bug stays strictly review/done.
- Ref link and backlinks navigate between cards inside the detail dialog
  (dialog follows by card id).
- 21 new tests across cards/board/board-actions/Board/QuickCapture/
  CardDetail/App. Suite: 174.

## Log

- 2026-07-16 captured via quick capture, enriched via discuss convention
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 21 tests (red → green), all gates clean, status → review
