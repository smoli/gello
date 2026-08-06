---
id: c0144
title: Creating a follow up card/issue should get the same tags and epic
status: review
created: 2026-08-05
updated: 2026-08-06
status-changed: 2026-08-05T12:55:54
epic: e03
tags: [Test]
---

If I create a follow up card/issue on a card with tags and/or epic the follow up should get the same tags and epic assignment

## Acceptance criteria

- [x] A follow-up created on a tagged card carries the same `tags:` line.
- [x] An issue reported on a tagged card carries the same `tags:` line.
- [x] A source card without tags produces a card with no `tags:` line.
- [x] The epic assignment keeps being inherited (already the case).

## Notes

- Both kinds go through `createRefCardFor` in `src/lib/board-actions.ts`, so
  tags are inherited in one place. The epic was already inherited there.
- `newCardRaw` gained a `tags` option and writes them as a flow list, the same
  format the surgical tag edits use.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 status → review (agent)
