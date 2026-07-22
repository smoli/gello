---
id: c0118
title: Show a small trigger for creating it on the card front
status: in-progress
ref: c0115
epic: e01
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T06:56:16
---

Reduces clicks

## What

A follow-up (c0115) currently costs three clicks from the board: open the card,
press **Follow up**, type. Put the trigger on the card front so reviewing work
and queueing more work happen in the same place.

## Acceptance criteria

- [x] A card front whose status is `review` or `done` shows a small follow-up
      trigger; a card in any other status shows none
- [x] Clicking the trigger opens the follow-up draft straight from the board,
      without opening the card detail first
- [x] The trigger's click does not fall through to the card (the detail view
      does not open behind the draft)
- [x] Submitting that draft creates exactly what c0115 creates — a task with
      `ref` to the card, the card's epic, landing in `ready`
- [x] The draft still states that the card lands in `ready`, so the click that
      can start an agent run stays legible (c0115)
- [x] The trigger is keyboard reachable and carries an accessible name naming
      the card it follows up on
- [~] The trigger stays quiet: it does not compete with the card's title,
      badges or tags — implemented, but verified by code/CSS review only, not
      on screen (see Notes)

## Notes

- The card arrived with no acceptance criteria (it was itself dashed off
  through the c0115 follow-up flow). The criteria above are my reading of
  "a small trigger for creating it on the card front"; the design calls behind
  them are in Discussion.

## Log

- 2026-07-22 status → in-progress (agent)
