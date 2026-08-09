---
id: c0170
title: 'App: sign-off column + check-list'
status: ready
epic: e08
depends: [c0164]
created: 2026-08-08
updated: 2026-08-09
status-changed: 2026-08-08T23:35:56
order: 30
---

## What

Present the `signoff` column ([[c0164]]) as the human's check-list of
AI-reviewed cards awaiting sign-off, and surface the pile size ([[c0161]]). The
human clears it by moving cards `signoff → done` (or reopening to
`review` / `in-progress`). A count/badge makes pending sign-offs visible at a
glance on return; the recorded review verdict is visible on each card.

## Acceptance criteria

- [ ] The `signoff` column presents its cards as the sign-off check-list, with
      each card's recorded verdict visible.
- [ ] The human can move a card `signoff → done`, and back to
      `review` / `in-progress` to reopen.
- [ ] A count/badge shows the number of cards awaiting sign-off.
- [ ] Component-tested (cards render in the column; the count reflects them).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
