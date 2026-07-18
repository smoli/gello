---
id: c053
title: Inbox column changes widht with horizontal resize
status: done
type: issue
ref: c050
milestone: m02
created: 2026-07-16
updated: 2026-07-16
---

Columns should all be same width, have a reasonable min-widht and grow in widht uniforly when the available space gets wider

## Log

- 2026-07-16 status → ready (app)
- 2026-07-16 status → done (app)

## Notes

- Root cause: the c052 track refactor moved width constraints onto
  .column-track; the inbox column wasn't track-wrapped, so it had no width
  discipline left. Inbox is now wrapped in a track like every lane, and all
  tracks share `flex: 1 1 220px; min-width: 220px` — same width, uniform
  growth with window width, 220px floor.

## Log

- 2026-07-16 status → ready (app)
- 2026-07-17 fixed (uniform track sizing), status → review
