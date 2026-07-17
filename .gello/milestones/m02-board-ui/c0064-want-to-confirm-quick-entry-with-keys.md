---
id: c0064
title: Want to confirm quick entry with keys
status: done
priority: normal
created: 2026-07-17
updated: 2026-07-17
milestone: m02
status-changed: 2026-07-17T14:33:13
---

ESC - Cancel
STRG/CMD+Enter submits

## Acceptance criteria

- [x] Esc cancels the quick-entry form without creating a card
- [x] Cmd/Ctrl+Enter submits from anywhere in the form (incl. Details)
- [x] Plain Enter in the Details textarea stays a newline

## Notes

- Form-level onKeyDown in CaptureForm (shared by quick capture and the
  report-issue draft), so both get the same keys. Esc already existed; added
  the Cmd/Ctrl+Enter submit. Plain Enter in Title still submits (existing).

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): Cmd/Ctrl+Enter submits the quick-entry form
  (form-level handler in CaptureForm); Esc-cancel already present. Tests added.
- 2026-07-17 status → done (app)
