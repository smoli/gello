---
id: c055
title: Sticky column header
status: review
priority: normal
created: 2026-07-16
updated: 2026-07-17
milestone: m02
status-changed: 2026-07-17T13:39:27
order: 20
---

## What

Each column's header (title + count) stays pinned to the top of the column
while its cards scroll, so you always know which column you're looking at in a
tall column.

## Acceptance criteria

- [x] Column title/count stay visible while scrolling a column's cards
- [x] Cards scrolling under the header don't show through (opaque strip)
- [x] Works for every column including the inbox, in plain and background modes

## Notes

- Pure CSS. Final approach: make **`.column-cards` the scroll container** (it
  gets `overflow-y: auto; flex: 1; min-height: 0`) and leave `.column-header`
  as a fixed, non-scrolling row at the column top . The
  header never overlaps cards, so it needs no fill of its own and shares the
  column's exact tone — never darker, no ghost of cards behind it.
- Rejected earlier attempts (recorded so nobody re-treads them): a `sticky`
  header *over* the scrolling column needs an opaque or frosted fill to hide
  cards passing under it — opaque reads darker than the frosted column, and
  translucent/frosted either double-darkens or leaves a faint card ghost.
  Moving the scroll to the cards area sidesteps all of it.
- Verified in the in-app browser via an injected board fixture (the plain Vite
  preview can't load a real board) in plain and background modes.
- No behavior change → no new tests.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): fixed header + scrolling .column-cards
  (CSS only). Iterated in-browser away from a sticky/opaque header (read
  darker than the frosted column / ghosted cards) to moving the scroll into
  the cards area — header now matches the column tone with no ghost.
