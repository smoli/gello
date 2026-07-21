---
id: i0121
title: Arhived cards should display where they should
status: in-progress
type: issue
ref: c018
epic: e05
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T22:31:22
---

done is sorted chronologically. Archived Cards do not show up chronologically right now.

## Acceptance criteria

- [x] Archiving a card leaves its position in the column unchanged
- [x] Unarchiving leaves it unchanged too
- [x] The card already archived on our own board is back at its real date

## Notes

- Cause: the archive move appended its Log line through `replaceCardBody`,
  which bumps `updated`. The done column sorts by
  `status-changed → updated → created`, and a card done before c056 has no
  `status-changed` — so the bump dragged it to the end of the column.
- Fix: `replaceCardBodyKeepingDates` in cards.ts — swaps the body, leaves the
  frontmatter byte-identical. Archive and unarchive both use it: a move is not
  an edit.
- The `updated: 2026-07-21` that c018 wrote onto c001 (archived on our own
  board) is restored to 2026-07-16, its date before the move.
- The c018 test that asserted the `updated` bump encoded the bug; it is
  replaced by two tests asserting the dates survive.

## Log

- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 archive/unarchive no longer bump `updated`; c001's date restored
