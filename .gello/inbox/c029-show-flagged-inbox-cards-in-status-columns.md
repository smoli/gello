---
id: c029
title: Show flagged inbox cards in their status column
status: backlog
priority: normal
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Inbox cards render only in the inbox column, whatever their status — so an
inbox idea flagged `status: discuss` (see c027) is invisible in the discuss
column, and the human can't see the triage pipeline on the board.

Proposed rule: inbox cards with a **non-backlog** status also appear in the
matching status column, inbox-badged. The inbox column then means
"unprocessed ideas" (status backlog) precisely. Decide whether such cards
become draggable between status columns (status change) while still untriaged.

Origin: c027 discussion (2026-07-16), open question.

## Log

- 2026-07-16 captured from c027 discussion
