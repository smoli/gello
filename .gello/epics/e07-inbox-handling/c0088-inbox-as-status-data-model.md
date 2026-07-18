---
id: c0088
title: Inbox-as-status data model
status: in-progress
epic: e07
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T17:18:40
order: 15
---

## What

The foundation for the inbox reframe (root of e07). Make `inbox` a normal
status/column and drop the inbox-*folder* specialness from the loader.

- `inbox` becomes a status value and the **first column** in the default
  `board.yaml` config.
- The loader no longer special-cases `.gello/inbox/`: cards load from
  `cards/` (no epic) and `epics/eNN/` (assigned) only. A card's inbox-ness is
  its `status`, not its folder.
- No board grouping/ordering by inbox-folder; the inbox column is an ordinary
  status column.

## Acceptance criteria

- [ ] `inbox` parses as a valid status; default `board.yaml` columns lead
      with `inbox`
- [ ] Loader reads `cards/` and `epics/eNN/`; no special handling for an
      `inbox/` folder
- [ ] A card with `status: inbox` in `cards/` or an epic folder loads into
      the inbox column
- [ ] Existing loader tests updated (inbox-folder fixtures → status-based)

## Notes

Carries the open question from c0087: an `inbox`-status card assigned to an
epic lives in `epics/eNN/` and shows in the inbox column labelled with its
epic — decide here whether that state is allowed.

## Log

- 2026-07-18 created from the e07 inbox reframe (c0087)
- 2026-07-18 status → ready (app)
