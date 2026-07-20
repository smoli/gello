---
id: c0105
title: MCP for status update and earlier in process
status: in-progress
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T08:58:04
epic: e08
---

Right now the agent takes a card in process after doing potentially extensive analysis. This is confusing for the user, because they might think that the agent didn’t pick up the card for quite some time. So have the agent take the card in process as soon as they start working on it.

Also add an MCP tool for status change of the active card.

## Acceptance criteria

- [ ] A `set_status` MCP tool on the gello server, scoped to the run's card
  (`GELLO_CARD_ID`), taking a `status` argument.
- [ ] Calling it moves the card: sets `status`, stamps `status-changed`, drops a
  stale manual `order`, appends a dated `## Log` line — same bookkeeping as an
  app move.
- [ ] An unknown status is refused as a tool error (not a crash); an unknown
  card is refused.
- [ ] Setting the status the card already has is a no-op: no rewrite, no
  duplicate Log line.
- [ ] The claude adapter allows both `add_question` and `set_status`.
- [ ] The task prompt tells the agent to move the card to `in-progress` right
  away, before analysis, via the tool.

## Notes

- The companion's boundary (runner.ts) is that the *companion process* never
  edits cards; the agent does, through the per-run MCP server (same place
  `add_question` already writes). `set_status` keeps that boundary — it runs in
  the run-scoped server, not the runner.
- Reuse the shared bookkeeping (`updateCardFields` + `appendLogLine`), mirroring
  the app's `saveCardFields`, so the on-disk shape of an agent move matches a
  drag-drop move.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 picked up (agent), status → in-progress
