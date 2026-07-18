---
id: c0075
title: Swimlanes by tag
status: discuss
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T16:17:17
---

Spun out of [[c0058]] (tags refinement): grouping the board into horizontal
lanes is a larger board-layout change than tag chips/filter/management, so
it lives on its own.

## What

Optionally split the board into horizontal **swimlanes**, one per tag, so
each lane shows that tag's cards across the status columns. A toggle turns
lanes on/off; when off, the board is the current single grid.

Depends on the tag surfaces from [[c0058]] (a card's tags being first-class
on the board) and reads the same `tags:` field.

## Open questions (pre-discuss)

- A card with several tags appears in several lanes — is that fine, or does a
  card get a single "primary" lane?
- Which tags become lanes: all tags in use, or a chosen subset?
- Interaction with the tag filter (c0058) and the epic filter — do lanes
  respect active filters?
- Cards with no tags — an "untagged" lane, or hidden when lanes are on?

## Log

- 2026-07-18 spun out of c0058 during the tags-refinement discussion
- 2026-07-18 status → discuss (app)
