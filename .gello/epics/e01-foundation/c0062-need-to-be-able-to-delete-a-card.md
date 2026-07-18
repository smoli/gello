---
id: c0062
title: Need to be able to delete a card
status: done
created: 2026-07-17
updated: 2026-07-17
epic: e01
status-changed: 2026-07-17T13:27:11
---

## What

Permanently delete a card from the card-detail view. Removes the Markdown
file and the card's `assets/<card-id>/` folder (concept §: id-keyed assets →
"cleanup on card deletion is one folder removal"). Guarded by a two-step
confirm since a hard delete isn't undoable. This is delete, not archive
(c018) — for discarding a card outright.

## Acceptance criteria

- [x] A Delete action in the card detail, behind an inline confirm (Delete →
      "Delete card and its images?" → Delete / Keep)
- [x] Confirming removes the card file, then its `assets/<card-id>/` folder
      (a no-op when the card has no attachments)
- [x] The board drops the card and the detail closes, optimistically; a write
      failure reverts and surfaces the error
- [x] Asset cleanup is skipped if the file removal fails (no half-delete)

## Notes

- Entry point is the card detail only; a per-card board context menu could add
  a delete affordance later, but none exists yet (i0011 added a *background*
  menu). Out of scope here.
- Rust `remove_dir` (recursive, tolerant of a missing dir) + `deleteCard`
  (file-then-folder) + `withoutCard` model update + a two-step confirm in
  CardDetail.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): Rust remove_dir + deleteCard/withoutCard +
  card-detail Delete with a two-step confirm. Tests: cargo (dir removal),
  vitest (action, model, confirm flow, App integration).
- 2026-07-17 status → done (app)
