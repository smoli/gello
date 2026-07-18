---
id: c002
title: Card/milestone types + frontmatter parse & serialize
status: done
epic: e01
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

- [x] Parse a valid card file into a typed Card (all frontmatter fields + body)
- [x] Round-trip: parse → change status → serialize preserves body, field
      order, and unknown/extra frontmatter fields byte-for-byte
- [x] Malformed YAML / unknown status / missing required fields yield a typed
      `InvalidCard` result (path + reason), never a throw or silent drop
- [x] `updated` field is bumped on serialize
- [x] board.yaml parsing with defaults for missing keys

## Notes

- Dependency decision: **`yaml` package instead of gray-matter** (deliberate
  deviation, CLAUDE.md + concept.md updated). Two reasons: gray-matter needs a
  Node `Buffer` polyfill in the Tauri webview, and the byte-for-byte criterion
  rules out YAML dumping anyway — serialization is done as surgical line edits
  on the raw text, so we need our own frontmatter splitter regardless.
- API: `parseCard` / `parseMilestone` return typed Result objects
  (`{ok:false, invalid:{path, reason, raw}}` — feeds c007's needs-attention
  lane). `updateCardFields` + `replaceCardBody` take a `today` param (injected
  clock, testable) and re-parse their own output as an internal invariant.
- Friendly coercion: scalar `depends: c001` becomes `["c001"]` — agents will
  write that. Unknown status/priority stay hard errors.
- 22 new tests, all criteria covered, incl. comment/unknown-field preservation
  and append-field-if-missing (milestone on inbox cards, for c013 triage).

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 tests-first (23 total, red → green), typecheck clean, status → review
