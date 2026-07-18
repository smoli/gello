---
id: i0033
title: Ship `discuss` in the default column lineup
status: review
type: issue
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T19:22:06
epic: e01
---

## What

gello ships the **gello-discuss** skill (interview a human about a
`discuss`-flagged card and write the outcome back), but the **default** board
doesn't include a `discuss` column — so a fresh board can't use the skill
without the user hand-editing `board.yaml`. Make `discuss` part of the default
lineup so the shipped skill works out of the box.

Proposed order (this repo already uses it):
`inbox` → `discuss` → `backlog` → `ready` → `in-progress` → `review` → `done`

Touch points:

- `src/lib/scaffold.ts` — `BOARD_YAML` (what a fresh `.gello/` gets).
- `src/lib/cards.ts` — `DEFAULT_BOARD_CONFIG.columns` (the fallback when a
  board has no `board.yaml`), for consistency.
- Tests: `scaffold.test.ts` column assertions; sweep any test that relies on
  the default columns not containing `discuss`.
- Docs: `README.md` and `concept.md` §4 currently call `discuss` *optional* —
  update to "default", and the scaffold convention snippet if it enumerates
  columns.

## Acceptance criteria

- [x] A freshly initialized board's `board.yaml` includes `discuss` in the
      default order (`inbox, discuss, backlog, ready, in-progress, review, done`)
- [x] `DEFAULT_BOARD_CONFIG` includes `discuss`
- [x] `discuss` parses as a valid status on a default board with no board.yaml
- [x] README + concept.md describe `discuss` as a default column (not optional)
- [x] Existing tests updated; suite + typecheck + lint green

## Notes

Ref: the e07 reframe set the default to `inbox, backlog, ready, …` (no
discuss). The discuss skill (c032) predates it. This closes the gap.

## Log

- 2026-07-18 created (agent): flagged by the human — since we ship the
  discuss skill, discuss should be a default column, not opt-in.
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): added `discuss` to the default lineup in
  scaffold.ts (BOARD_YAML) and cards.ts (DEFAULT_BOARD_CONFIG), order
  inbox → discuss → backlog → ready → in-progress → review → done. README +
  concept.md updated (default, not optional). Tests: scaffold/default-lineup
  assertions + the empty-board column count. 501 tests + typecheck + lint green.
