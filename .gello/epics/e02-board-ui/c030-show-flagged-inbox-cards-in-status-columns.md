---
id: c030
title: Show flagged inbox cards in their status column
status: done
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
epic: e02
---

## What

Inbox cards render only in the inbox column, whatever their status — so an
inbox idea flagged `status: discuss` (see c027) is invisible in the discuss
column, and the human can't see the triage pipeline on the board.

Rule (implemented): inbox cards with a **non-backlog** status appear in the
matching status column, inbox-badged; the inbox column means "unprocessed
ideas" (status backlog) precisely. Inbox cards are fully draggable and
key-movable — a status move never touches the milestone or the file's
location; triage via the detail dialog remains the only way out of inbox/.

Origin: c027 discussion (2026-07-16), open question; requested by Stephan
("move from inbox to discuss without a milestone assigned"). (Originally
allocated c029, renumbered after colliding with a concurrently quick-captured
card — see c031.)

## Acceptance criteria

- [x] Dragging an inbox card onto a status column changes only its status
- [x] Non-backlog inbox cards render in their status column, inbox-badged
- [x] Inbox column shows only status-backlog inbox cards; hidden when none
- [x] Keyboard moves work on inbox cards
- [x] Milestone filter keeps flagged inbox cards visible

## Notes

- Reverses c013's "inbox cards are not draggable" — that rule predated a
  reason for an untriaged card to change status; discuss (c027) is that
  reason. The `interactive` prop distinction was deleted entirely; all cards
  share one CardFront behavior.
- 4 new/updated Board tests; drag test asserts `milestone: null` survives.

## Log

- 2026-07-16 captured from c027 discussion
- 2026-07-16 requested by Stephan ("move from inbox to discuss without a milestone"), triaged to m02, picked up (agent)
