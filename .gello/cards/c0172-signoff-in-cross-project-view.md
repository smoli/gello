---
id: c0172
title: Cross-project view ignores signoff
status: inbox
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:59:40
---

## What

The cross-project activity view aggregates `ready` / `in-progress` / `review`
(`MULTI_COLUMNS` in `src/lib/multi.ts`), and its done drop area accepts a
`review` card. With `signoff` ([[c0164]]) the cards actually waiting for the
human sit in `signoff`, and the view neither shows them nor accepts them.

Decide whether `signoff` joins the aggregated columns, replaces `review` as
what the done area accepts, or both.
