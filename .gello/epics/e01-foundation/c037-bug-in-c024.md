---
id: c037
title: Escaping bug creation from card creates empty bug
status: done
type: issue
ref: c024
epic: e01
created: 2026-07-16
updated: 2026-07-16
tags: []
---
This was one of them

## Notes

- Reworked report-bug to **draft-first**: the button opens a capture form
  ("New bug for cXXX") carrying the ref/milestone context; the file is only
  created on submit — with the real title, so the filename slug is
  meaningful too. Escape closes the form with zero side effects; the source
  card's dialog stays open underneath.
- The form is the extracted `CaptureForm`, now shared by quick capture
  (⌘N/⌘B) and report-bug — one draft component, three entries.
- Supersedes c035's open-in-edit-mode behavior: the draft form is the
  zero-extra-click entry; the created bug opens in view mode with its
  content already in place. CardDetail's `startInEdit` prop remains
  (component-tested) for future use.
- `createBugFor` now takes `{title, body}` from the draft.

## Log

- 2026-07-16 reported via report-bug flow (Stephan) — this card itself was
  an escape-orphaned empty bug, later filled in
- 2026-07-17 draft-first rework, tests red → green (178), status → review