---
id: c0089
title: Capture to cards/ with status inbox
status: in-progress
epic: e07
depends: [c0088]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T17:18:40
order: 18.75
---

## What

New card capture writes to `.gello/cards/` with `status: inbox` (was
`.gello/inbox/` with `status: backlog`). No epic assigned.

## Acceptance criteria

- [ ] Quick capture (idea/issue) creates the card in `cards/` with
      `status: inbox`
- [ ] The card appears in the inbox column immediately (optimistic)
- [ ] Any reserved-id / pasted-image flows (i0013/i0022) still line up under
      the new location
- [ ] Report-issue and other creation paths land in the right folder/status
      for the new model

## Log

- 2026-07-18 created from the e07 inbox reframe (c0087)
- 2026-07-18 status → ready (app)
