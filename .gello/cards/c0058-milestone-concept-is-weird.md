---
id: c0058
title: Surface tags on the board (chips, filter, management)
status: done
created: 2026-07-17
updated: 2026-07-20
status-changed: 2026-07-20T22:46:12
---

Right now it is less a milestone, which would suggest a sequence on how to work on things but more a domain thing, foundation, UI, etc.

## What

Make the **existing `tags:` field** a first-class cross-cutting axis on the
board. Tags already parse, are editable in card detail, and are searchable
(c022) — but they're invisible on the board and can't be filtered or managed.
Now that epics ([[c0074]]) own the container/grouping-with-charter role, tags
are gello's honest cross-cutting label dimension (a card lives in one epic and
may carry several tags). This is a **pure refinement of that field** — no
schema change, no storage change.

Add three surfaces, all over the same `tags:` field:

- **Tag chips on card fronts** — each card shows its tags as small chips
  (today they only appear in detail).
- **Multi-select tag filter** — a toolbar filter alongside the epic and type
  filters; a card matches if it carries any selected tag, composing with the
  other filters and search.
- **Tag management** — a view listing every tag in use (with counts), where
  the user can assign a colour to a tag (chips + filter reflect it) and
  rename a tag everywhere it appears.

Out of scope: per-tag charter files (the charter home is `epic.md`, c0074);
swimlanes-by-tag (spun out to [[c0075]]).

## Acceptance criteria

- [x] Card fronts render each of a card's tags as a chip; a card with no tags
      shows none
- [x] Toolbar multi-select tag filter lists the tags in use; selecting tags
      shows only cards carrying any selected tag; composes with the epic +
      type filters and search (all AND); clearing restores all
- [x] Each tag has a stable colour reflected by its chips and its filter
      entry; a management surface lets the user set/change a tag's colour
- [x] Tag management lists all tags in use with a per-tag card count
- [x] Rename-a-tag updates every card carrying it — surgical `tags:` edits,
      atomic per file — and the board reflects the change live
- [x] Existing tag editing in card detail is unchanged; every new surface
      reuses the same `tags:` field (no new field, no schema change)
- [x] concept.md / CLAUDE.md note tags as the cross-cutting label axis,
      distinct from epics (the container axis)

## Discussion

- **Pure refinement, not a migration**: the milestone-replacement scope is
  gone — [[c0074]] renames milestones to epics and keeps them as the
  container axis, which leaves tags to be exactly what they already are:
  cross-cutting labels. So this card just makes that field *visible and
  usable* on the board (chips, filter, management). No storage/schema change.
- **Flat label space, no domain/ad-hoc split**: the earlier open question —
  distinguish "domain" tags from ad-hoc ones like `agent-dx` — resolves to
  *no distinction*. Tags are one flat label space; epics carry the
  structural/container role, so tags don't need to.
- **Charter dropped**: `epic.md` (c0074) is the one charter home; a second
  charter surface on tags would compete. (Rejected: `.gello/tags/<tag>.md`.)
- **Rename-everywhere is the one write with reach**: it edits many card files;
  do it as surgical per-file `tags:` edits, atomic each, and let the watcher
  reconcile — the same model as every other board write.
- **Swimlanes spun out** ([[c0075]]): grouping the board into per-tag lanes is
  a larger board-layout change, not a field refinement — captured separately.
- **Ordering vs c0074**: the framing "tags = cross-cutting, epics =
  container" assumes epics exist. Tags-as-labels still work alongside the
  current milestones if this lands first, but the two-axis story wants c0074
  in place. Prefer c0074 first.
- **Open**: tag colour assignment (auto from a palette by name-hash, vs
  user-picked, vs both); whether rename into an existing tag *merges*;
  tag-name validation (kebab-case vs free text — currently free strings).

## Notes

Decisions taken on the three open questions (AC gave enough to proceed without
blocking):

- **Colour = auto default + optional user override.** Every tag gets a stable
  colour from a fixed palette, picked by hashing the tag name (deterministic, so
  a tag looks the same everywhere without any config). The management surface
  lets the user override it; overrides persist in `board.yaml` under a
  `tag_colors:` mapping (surgical nested edit, never dumped). Chips and the
  filter entry use the override if set, else the auto colour.
- **Rename merges (dedups).** Renaming `a`→`b` on a card that already carries
  `b` yields one `b`, not two. Order is preserved (first occurrence wins). The
  colour key follows the rename; on a merge the destination keeps its own colour
  if it has one, else inherits the source's.
- **Tag names stay free strings.** Trimmed, empty rejected, commas disallowed
  (they split) — same permissiveness as the existing card-detail tag input. No
  kebab-case enforcement.

Implementation plan (test-first, small green commits):

1. `src/lib/tags.ts` (pure): `collectTags`, `autoTagColor`, `tagColor`,
   `renameTagInList`, `planTagRename`.
2. `board.yaml` `tag_colors`: parse into `BoardConfig.tagColors`; surgical
   `setTagColor`/`removeTagColor` in `boardyaml.ts`.
3. Tag chips on card fronts (`Board.tsx` `CardFront`).
4. Multi-select tag filter in the toolbar (AND with epic + type + search).
5. Tag management surface (counts, colour picker, rename-everywhere) + App
   wiring (`renameTag` board-action: one atomic `tags:` edit per card).
6. Docs: tags as the cross-cutting axis in concept.md + CLAUDE.md.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): milestones fully replaced by tags — flat
  cards/ + inbox/ capture, optional per-tag charter files, no sequencing,
  self-migration. Flagged as an epic to break down; intersects i0005/c028.
- 2026-07-17 status → backlog (app)
- 2026-07-18 status → discuss (app)
- 2026-07-18 reframed (human): milestones stay (as epics, c0074), so this is
  now a pure refinement of the existing `tags:` field — chips on fronts,
  multi-select filter, tag management (colour + rename-everywhere). Dropped
  the milestone-removal/flat-cards/migration/per-tag-charter scope; swimlanes
  spun out to c0075. Retitled.
- 2026-07-18 status → backlog (app)
- 2026-07-18 status → discuss (app)
- 2026-07-18 status → backlog (app)
- 2026-07-18 status → discuss (app)
- 2026-07-18 status → backlog (app)
- 2026-07-18 status → discuss (app)
- 2026-07-18 status → backlog (app)
- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 implemented (agent): tag utilities + `tag_colors` config storage;
  coloured chips on card fronts; multi-select toolbar tag filter (AND with
  epic/type/search); tag manager (counts, colour picker, rename-everywhere);
  `renameTag` board-action (one atomic `tags:` write per card, merge on
  collision, colour follows); concept.md + CLAUDE.md updated. All seven
  acceptance criteria met, TDD throughout. Landed as four commits. Note:
  Board.tsx/Board.css/Board.test.tsx were being edited in parallel for c0108
  (drag highlight) in the same tree — staged only the c0058 hunks so that
  work stays intact and uncommitted.
- 2026-07-20 status → review (agent)
- 2026-07-20 status → done (app)
