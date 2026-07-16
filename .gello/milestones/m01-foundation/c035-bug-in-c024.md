---
id: c035
title: Quicker entry for bugs by referrence
status: done
priority: normal
type: issue
ref: c024
milestone: m01
created: 2026-07-16
updated: 2026-07-16
tags: []
---
When opening a bug from a card, I need to again click the edit button. I do not want to make that click.

## Notes

- Fixed: report-bug now opens the fresh bug's detail directly in edit mode
  (title input focused-ready, body textarea live). CardDetail gained a
  `startInEdit` prop; normal card opens are unaffected.
- Bonus fix uncovered while implementing: the detail dialog is now
  remounted per card (React key on card path), so navigating between cards
  (ref links, backlinks) can never carry stale edit drafts from one card
  onto another — a latent cross-card clobber path that existed since c010.

## Log

- 2026-07-16 reported via report-bug flow (Stephan), ref c024
- 2026-07-16 fixed (agent), test-first, status → review