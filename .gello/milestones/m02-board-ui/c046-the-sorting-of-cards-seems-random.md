---
id: c046
title: The sorting of cards seems random
status: review
priority: normal
type: issue
created: 2026-07-16
updated: 2026-07-16
milestone: m02
---
It is not by card number, not by creation time, …

Make it by card number for now.

Create a card to discuss better options

## Log

- 2026-07-16 status → ready (app)

## Notes

- Cause: columns rendered cards in milestone-group order (each group sorted
  internally), so priorities interleaved per milestone — perceived as random.
- Fix: each column now sorts globally by **priority (high first), then card
  ID** — same-priority cards therefore appear in creation order. Inbox
  column already did this.

## Log

- 2026-07-16 reported (Stephan)
- 2026-07-17 fixed, test-first, status → review
