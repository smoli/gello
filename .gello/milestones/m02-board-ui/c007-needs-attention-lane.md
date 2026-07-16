---
id: c007
title: Needs-attention lane for malformed cards
status: review
milestone: m02
priority: normal
depends: [c005]
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Cards the parser rejects (invalid YAML, unknown status) appear in a dedicated
"needs attention" lane with path and reason — never silently hidden. Clicking
opens the raw file content.

## Acceptance criteria

- [x] Invalid cards from the BoardModel render in the lane with reason
- [x] Lane is hidden when there is nothing to show
- [x] Raw file content is viewable from the lane entry

## Notes

- Amber lane below the columns, only mounted when `model.invalid` is
  non-empty. Each entry: monospace path, human-readable reason (straight from
  cards.ts InvalidFile — same strings as the parse errors), and a
  show file / hide file toggle revealing the raw content in a <pre>.
- Not affected by the milestone filter — invalid files have no reliable
  milestone, and hiding them would defeat the lane's purpose.
- Small a11y lesson: <aside> maps to role "complementary"; tests query
  role "region", so the lane is a <section aria-label> like the columns.
- 3 new tests: entries with path+reason, lane absent when all parse,
  raw reveal on demand.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 3 tests (red → green), demoed live with a planted broken card, status → review
