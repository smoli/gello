---
id: c0131
title: Make a setting to choose where the follow up card should go
status: in-progress
ref: c0118
epic: e01
created: 2026-07-23
updated: 2026-07-23
status-changed: 2026-07-23T20:08:40
---

* Inbox
* Discuss
* Backlog
* Ready

as a last option: Ask

Ask will open a popup for the user to decide the column

Setting available in the settings menu of the context menu

## Notes

Design settled (see the card body + acceptance criteria below):

- Persist in `board.yaml` as `followup_target` (a column name or `ask`),
  surgical write like `show_tags`; default `ready` preserves c0115.
- Offer the four named columns that the board actually has, plus `Ask`.
- `Ask` opens a small column-picker popup, then the draft targets that column.
- The draft note reflects the real target — the "a companion will start on it"
  line only when the target is `ready`.

**Done and green in isolation** — the whole non-UI layer:

- `BoardConfig.followupTarget` + `parseBoardConfig` reads `followup_target`.
- `createFollowUpFor(..., status)` and `createRefCardFor(..., statusOverride)`.
- `FOLLOWUP_TARGET_COLUMNS` in board-actions.
- Tests in cards / board-actions / boardyaml — 141 lib tests pass.

**Blocked on a red workspace that is not this card's** (see the question):
the UI wiring must go into `App.tsx` and `Board.tsx`, and both are already
broken before I touch them, so I cannot reach a green `pnpm test` / `typecheck`
to commit against "never commit red".

## Log

- 2026-07-23 status → in-progress (agent)
- 2026-07-23 blocked (agent): finished the c0131 lib layer (config +
  createFollowUpFor target, 141 lib tests green) but the workspace is red from
  unfinished work outside c0131 — HEAD's Board.tsx (c0121 hover threading) and
  uncommitted c0132 duplicate-id work in App.tsx/board.ts. Asked the human how
  to proceed.
