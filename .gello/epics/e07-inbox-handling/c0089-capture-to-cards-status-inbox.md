---
id: c0089
title: Capture to cards/ with status inbox
status: done
epic: e07
depends: [c0088]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T18:10:02
---

## What

New card capture writes to `.gello/cards/` with `status: inbox` (was
`.gello/inbox/` with `status: backlog`). No epic assigned.

## Acceptance criteria

- [x] Quick capture (idea/issue) creates the card in `cards/` with
      `status: inbox`
- [x] The card appears in the inbox column immediately (optimistic)
- [x] Any reserved-id / pasted-image flows (i0013/i0022) still line up under
      the new location
- [x] Report-issue and other creation paths land in the right folder/status
      for the new model

## Log

- 2026-07-18 created from the e07 inbox reframe (c0087)
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): part of the e07 inbox-as-status reframe, landed as one coherent pass; full suite (500) + Rust (41) + typecheck + lint green.
- 2026-07-18 status → done (app)
