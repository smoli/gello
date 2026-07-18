---
id: c013
title: Quick capture to inbox + triage to milestone
status: done
epic: e03
depends: [c005, c009]
tags: [ui, core]
created: 2026-07-16
updated: 2026-07-16
---

## What

The idea-capture flow: a global shortcut/button opens a minimal input; submit
creates a card in `.gello/inbox/` with the next free ID. Triage: assigning an
inbox card to a milestone moves the file into the milestone folder, updates
the `milestone` field, and rewrites relative asset links.

## Acceptance criteria

- [x] Title (+ optional body) → inbox card file, in under 5 seconds from focus
- [x] New card gets next free sequential ID
- [x] Inbox renders as its own area/column on the board
- [x] Triage moves the file, sets `milestone`, rewrites asset link prefixes
- [x] Triaged card's images still resolve (test with a real attachment)

## Notes

- **Capture**: "+ New idea" button (fixed top-right) + global ⌘N/Ctrl+N.
  Title input autofocused, Enter submits, Escape cancels; optional details
  textarea. `createCard` → `newCardRaw` (cards.ts, quote-safe titles) with
  `nextCardId`, slugified filename, backlog/normal defaults. c021 can reuse
  this mechanism 1:1.
- **Inbox is now its own leftmost column** — inbox cards left the status
  columns entirely (cleaner "not on the board yet" semantics). They are
  selectable but not draggable/key-movable; the way onto the board is triage.
  The redundant inbox filter option was removed. Column hidden when empty.
- **Triage** via the milestone select in the card detail (inbox cards only —
  the c009 read-only milestone becomes editable exactly where editing means a
  real file move). `triageCard`: sets `milestone`, rewrites `](../assets/` →
  `](../../assets/` (retargetAssetLinks; web/absolute URLs untouched),
  **writes the new file, then deletes the old** (new Rust `remove_file`
  command) — a failure in between leaves a visible duplicate, never a lost
  card (tested: delete is skipped when the write fails).
- Real-attachment test: a temp .gello tree with an actual asset file; the
  rewritten link, resolved from the card's new location, must hit that file.
- applyAction generalized to take a model transform (update / add-to-inbox /
  triage-move); detail dialog follows the card to its new path.
- 25 new tests (2 Rust, 23 frontend). Suite: 125 frontend + 15 Rust.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 25 tests (red → green), all gates clean, status → review
