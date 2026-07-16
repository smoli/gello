---
id: c041
title: Editing a card allows editing the logs
status: done
priority: normal
type: issue
created: 2026-07-16
updated: 2026-07-16
milestone: m03
---

## Notes

- Edit mode now shows the body *without* the `## Log` section; on save the
  machine-managed Log is reattached byte-identically (a hint in the editor
  says so). Deliberate log corrections remain possible via any external
  editor — the app just stops accidental ones.
- Assumption (matches convention): the Log section runs to the end of the
  body. Content after a Log section would be protected along with it.
- Designed together with c042 (the app now writes those log lines).

## Log

- 2026-07-16 reported (Stephan)
- 2026-07-17 implemented with c042, status → review
- 2026-07-16 status → done (app)
