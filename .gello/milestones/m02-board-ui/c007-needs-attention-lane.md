---
id: c007
title: Needs-attention lane for malformed cards
status: backlog
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

- [ ] Invalid cards from the BoardModel render in the lane with reason
- [ ] Lane is hidden when there is nothing to show
- [ ] Raw file content is viewable from the lane entry

## Notes

## Log

- 2026-07-16 created from concept breakdown
