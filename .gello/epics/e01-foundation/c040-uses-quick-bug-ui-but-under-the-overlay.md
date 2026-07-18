---
id: c040
title: Uses quick bug UI but under the overlay
status: done
type: issue
ref: c037
epic: e01
created: 2026-07-16
updated: 2026-07-16
---

Using the quick bug creation ui is fine but, it is displayed under the overlay and on the top left which is far away from where the user clicked the button

## Notes

- Fixed: the report-bug draft now renders in its own overlay (z above the
  card-detail dialog), centered with a dim backdrop — right where the eye
  is after clicking "Report bug". Quick capture (⌘N/⌘B) keeps its top-right
  position.
- Process: taken from ready out of ID order (c039 was lower) — two-line
  same-area fix unblocking the c037 flow.

## Log

- 2026-07-16 reported via report-bug flow (Stephan), ref c037
- 2026-07-17 fixed, status → review
