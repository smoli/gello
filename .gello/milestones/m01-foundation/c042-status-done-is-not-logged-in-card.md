---
id: c042
title: "Status -> done is not logged in card"
status: done
priority: normal
type: issue
created: 2026-07-16
updated: 2026-07-16
milestone: m01
---

## Notes

- Every app-made status change (drag, keyboard, detail select) now appends
  `- <date> status → <new> (app)` to the card's `## Log`, creating the
  section at the body's end if missing. Composed with the frontmatter edit
  into ONE atomic write; no-op status "changes" and non-status field edits
  don't journal.
- `appendLogLine` inserts at the end of the Log section even when Log isn't
  the last section (next-heading aware).
- Designed together with c041 (Log ownership: machine-written, human-read).

## Log

- 2026-07-16 reported (Stephan)
- 2026-07-17 implemented with c041, status → review
- 2026-07-16 status → done (app)
