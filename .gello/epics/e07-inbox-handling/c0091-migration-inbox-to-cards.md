---
id: c0091
title: Migration — inbox/ to cards/ + status inbox
status: ready
epic: e07
depends: [c0088]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T16:53:15
order: 16.25
---

## What

Migrate existing boards to the inbox-as-status model: move every
`.gello/inbox/*.md` into `.gello/cards/` and set `status: inbox`. Add the
`inbox` column to `board.yaml`. Asset links are unchanged (inbox/ and cards/
are both depth 1).

Runs via the app's existing board migration path (detect old layout on open,
convert; c0079-style), and covers this repo's own board.

## Acceptance criteria

- [ ] Every `inbox/*.md` moves to `cards/` with `status: inbox`; the
      `inbox/` folder is removed
- [ ] `board.yaml` gains `inbox` as the first column
- [ ] Asset links resolve after the move (no depth change)
- [ ] Migration is recoverable (write-new-before-remove-old)
- [ ] This repo's board migrated; dogfood load test green, zero invalid
- [ ] A non-backlog inbox card (old c030 flagged card) migrates coherently
      (its status preserved, now a plain card in that column)

## Log

- 2026-07-18 created from the e07 inbox reframe (c0087)
- 2026-07-18 status → ready (app)
