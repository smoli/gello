---
id: c0058
title: Milestone concept is weird
status: backlog
priority: normal
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T11:37:45
---

Right now it is less a milestone, which would suggest a sequence on how to work on things but more a domain thing, foundation, UI, etc.

## What

Replace the **milestone** concept entirely with **tags**. Milestones today
imply a temporal sequence (they carry `due` + `status`), but they're used
as domains — Foundation, Board UI, Card Detail. Domains are what tags are
for, and a card can belong to several — which folders can't express.

The change, end to end:

- **Storage**: drop `.gello/milestones/<m>/` folders. Triaged cards live
  flat in `.gello/cards/`. Capture still lands in `.gello/inbox/`; triage
  moves the file `inbox/ → cards/` and adds one or more tags (still one
  folder move + asset-link rewrite, but only the two-level depth, never
  per-milestone).
- **Schema**: remove the `milestone:` field, the `Milestone` type, `m-id`
  allocation, and `milestone.md`. Grouping is expressed by `tags: [...]`.
- **Board**: the milestone filter becomes a **tag filter** (multi-select —
  a card matches if it has the selected tag). Grouping/labels on cards show
  tags instead of a single milestone.
- **Per-tag charter**: a tag may optionally have a
  `.gello/tags/<tag>.md` with a Goal / Definition of Done, shown when the
  board is filtered to that tag. This preserves the milestone.md "area
  charter" without folders — optional, absence is normal.
- **No sequencing dimension**: `due` and milestone `status` are dropped;
  the board's only time signal is the status columns and `ready`.
- **Migration**: convert this repo's own board — each `m0x-name/` becomes
  tag `name` on its cards, cards move to `.gello/cards/`, each
  `milestone.md` becomes `.gello/tags/<name>.md`, `milestone:` fields and
  m-ids removed, asset links rewritten. The dogfood test must stay green.

## Acceptance criteria

- [ ] `milestone` field, `Milestone` type, m-id allocation, and
      `milestone.md` handling removed from schema, loader, and actions
- [ ] Triaged cards load from a flat `.gello/cards/`; `.gello/inbox/`
      remains the capture area; loader groups/filters by `tags`
- [ ] Triage moves a card `inbox/ → cards/`, adds the chosen tag(s),
      rewrites relative asset links, atomically (write-new-then-delete)
- [ ] Board toolbar has a multi-select tag filter (was milestone filter);
      a card matches if it carries any selected tag; card fronts show tags
- [ ] Optional `.gello/tags/<tag>.md` (Goal/DoD) parses and renders when
      the board is filtered to that tag; its absence is not an error
- [ ] `due` and milestone `status` no longer exist anywhere
- [ ] This repo's board is migrated (folders → flat + tags, milestone.md →
      tags/*.md, links rewritten) and the dogfood load test passes with
      zero invalid files
- [ ] concept.md rewritten: "Concept → tags → cards"; CLAUDE.md board
      conventions updated (triage = add tag, not move to milestone)

## Discussion

- **Everything becomes tags, milestones removed outright**: the user's
  call — milestones were neither sequenced nor single-membership, so they
  were folders pretending to be a taxonomy. Tags are the honest model and
  give free multi-membership (a card can be `foundation` + `ui`).
  (Rejected: rename-only; rejected: two dimensions grouping+milestone;
  rejected: keeping any sequencing/`due`.)
- **inbox/ stays a folder, cards/ is flat**: preserves a physical
  "unprocessed" area (capture is a folder drop, cheap for agents), while
  everything triaged is one flat namespace filtered by tag. Triage keeps
  one folder move — acceptable, and asset-link depth is now constant.
- **Per-tag charter is optional** (`.gello/tags/<tag>.md`): keeps the
  milestone.md Goal/DoD idea for tags that want it, without forcing a file
  per tag. (Rejected: drop it entirely; rejected: fold all goals into
  concept.md — loses the filter-to-area context.)
- **Multi-select tag filter**: with multi-membership, the single-select
  milestone dropdown no longer fits; matching is "has any selected tag".
- **This is an epic, not one card**: schema removal, storage/layout, board
  UI, per-tag charter, and the self-migration are each substantial and
  independently testable. Recommend breaking into a milestone… er, a set
  of cards (grouped by the `refactor`/`tags` tag once tags exist) before
  implementation. It also intersects [[i0005]] and [[c028]] (both describe
  inbox→milestone triage, which becomes inbox→tag) — those must be
  reconciled or refiled against the tag model.
- **Open**: does a card require ≥1 tag once triaged, or can a tagged-less
  card live in `cards/` (untagged = a valid "misc" state)? Tag naming
  rules (kebab-case? free text?); whether the existing `tags` field (used
  for ad-hoc labels like `agent-dx`) and domain tags should be
  distinguished or deliberately unified.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): milestones fully replaced by tags — flat
  cards/ + inbox/ capture, optional per-tag charter files, no sequencing,
  self-migration. Flagged as an epic to break down; intersects i0005/c028.
- 2026-07-17 status → backlog (app)
