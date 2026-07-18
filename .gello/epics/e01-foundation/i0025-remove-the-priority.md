---
id: i0025
title: Remove the priority
status: done
type: issue
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T06:48:18
epic: e01
---

The user does not need the priority of cards anymore. They use ordering

## What

Remove the card `priority` field entirely. c056 already made priority
display-only (manual column order is the real signal), so all that's left is
a vestigial badge — and the user orders cards instead. Delete it.

Removal spans:

- **Schema** (`cards.ts`): drop the `Priority` type, `PRIORITIES`,
  `Card.priority`, priority parsing/validation, and `priority` from
  `newCardRaw` and `CardFieldChanges`.
- **UI**: remove the priority badge from card fronts (`Board.tsx` +
  `Board.css`) and the priority selector from card detail.
- **Templates**: `scaffold.ts` and the managed skill templates
  (`skills.ts`) stop emitting/mentioning `priority`.
- **Convention**: the pick-up-work rule loses its priority basis — it
  becomes "the **top of the `ready`** column (whose `depends` are all
  `done`)", the manual c056 order being the signal. Update CLAUDE.md and
  concept.md §4 (which also drops `priority` from the card schema).
- **This repo's board**: strip the `priority:` line from every card
  (surgical). User boards are *not* migrated — a leftover `priority:` line is
  silently ignored (the parser already ignores unknown fields), so old boards
  keep working with a harmless dead line.

## Acceptance criteria

- [x] `Priority`/`PRIORITIES`/`Card.priority` and priority parsing removed
      from `cards.ts`; `newCardRaw` and `CardFieldChanges` no longer carry it
- [x] A card with a leftover `priority:` line still parses (unknown field
      ignored, card valid) — no forced migration for user boards
- [x] Priority badge gone from card fronts; priority selector gone from card
      detail
- [x] `scaffold.ts` and the skill templates no longer emit/mention `priority`
- [x] concept.md §4 drops the `priority` field; the pick-up convention in
      concept.md + CLAUDE.md reads "top of the `ready` column, `depends` done"
- [x] This repo's board has the `priority:` line stripped from every card;
      dogfood load test green
- [x] Test suite updated (fixtures/badge assertions) and green

## Discussion

- **Vestigial after c056**: priority stopped affecting order in c056 — manual
  order became the signal — leaving only a badge the user doesn't use. So
  this is deletion, not a behaviour change.
- **Soft removal, strip this repo only** (user's call): the parser already
  ignores unknown fields, so user boards keep working with a dead `priority:`
  line — no migration pass forced for a harmless line. This repo's board is
  cleaned surgically for tidiness. (Rejected: migrate every user board;
  rejected: leave this repo's lines.)
- **Pick-up convention → top of ready**: with no priority, "highest-priority
  ready card" is meaningless; the c056 manual order *is* the priority signal,
  so the rule is "top of `ready`, depends done". Consistent with how ordering
  already works.
- **Ripple — c026 tool names**: [[c026]]'s `get_highest_priority_issue` /
  `get_highest_priority_card` are really "top of ready" getters; with
  priority gone the "highest_priority" name is a misnomer — c026 should name
  them by top-of-ready. (Flag on c026; not changed here.)
- **Open**: none — scope is clear.

## Log

- 2026-07-18 status → discuss (app)
- 2026-07-18 discussed (agent): remove priority (vestigial post-c056) from
  schema/UI/templates/docs; strip this repo's board, tolerate leftover lines
  on user boards; pick-up convention → top of ready; flags c026 tool naming
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): removed priority from schema (cards.ts),
  card front badge + detail selector, scaffold/skill templates (SKILL_VERSION
  bumped to 2), concept.md/CLAUDE.md (pick-up = top of ready); stripped the
  priority line from all 104 board cards. Parser now ignores a leftover
  priority line. Full suite + typecheck + lint green; all cards parse.
- 2026-07-18 status → done (app)
