---
id: c002
title: Card/milestone types + frontmatter parse & serialize
status: backlog
milestone: m01
priority: high
depends: [c001]
tags: [core]
created: 2026-07-16
updated: 2026-07-16
---

## What

The single frontmatter I/O module (`src/lib/cards.ts` or equivalent): typed
Card, Milestone, and BoardConfig models; parse from Markdown, serialize back.
This is the contract from concept.md §4 — no other module touches card YAML.

## Acceptance criteria

- [ ] Parse a valid card file into a typed Card (all frontmatter fields + body)
- [ ] Round-trip: parse → change status → serialize preserves body, field
      order, and unknown/extra frontmatter fields byte-for-byte
- [ ] Malformed YAML / unknown status / missing required fields yield a typed
      `InvalidCard` result (path + reason), never a throw or silent drop
- [ ] `updated` field is bumped on serialize
- [ ] board.yaml parsing with defaults for missing keys

## Notes

## Log

- 2026-07-16 created from concept breakdown
