---
id: i0013
title: Pasting does only work in Edit card
status: done
priority: normal
type: issue
ref: c011
milestone: m03
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T13:13:35
---

Should work in quick create as well, for issue and regular cards

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Shared the paste/drop logic into a `useImageInsert` hook (used by both the
  card-detail editor and the quick-capture Details field), so behavior can't
  drift between them.
- The draft card has no id yet, so the first image paste **reserves** the next
  id (`nextCardId`/`nextIssueId` by draft type); `createCard` reuses it on
  submit (new optional `id` param) so the asset folder and the link agree.
  Reservation is dropped on cancel; a pasted-then-cancelled image is a harmless
  orphan (same as cancelling a card-detail image edit).
- Scope: quick-create (⌘N idea / ⌘I issue). The report-issue draft (c037) uses
  the same CaptureForm but isn't wired yet — natural follow-up.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): extracted useImageInsert hook; wired image
  paste/drop into quick-create with a reserved-id scheme so pasted assets land
  under the card's eventual id. Tests: hook via component tests, createCard id
  param, QuickCapture paste, App reserve→create integration.
