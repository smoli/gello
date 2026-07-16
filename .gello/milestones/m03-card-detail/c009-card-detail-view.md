---
id: c009
title: Card detail view with rendered Markdown
status: backlog
milestone: m03
priority: high
depends: [c005]
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Clicking a card opens its detail: frontmatter fields as a compact header,
body rendered as Markdown, acceptance-criteria checkboxes toggleable (toggle
writes the file).

## Acceptance criteria

- [ ] Body renders as Markdown (headings, lists, code, images)
- [ ] Checkbox toggle persists via atomic write, preserving the rest of the body
- [ ] Header shows and allows editing status, priority, milestone, tags
- [ ] Frontmatter edits round-trip through the c002 module only

## Notes

## Log

- 2026-07-16 created from concept breakdown
