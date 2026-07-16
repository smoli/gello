---
id: c006
title: Drag & drop persists status to frontmatter
status: backlog
milestone: m02
priority: high
depends: [c004, c005]
tags: [ui, core]
created: 2026-07-16
updated: 2026-07-16
---

## What

Dragging a card to another column updates its `status` frontmatter field via
the atomic write layer. Optimistic UI, rollback on write failure.

## Acceptance criteria

- [ ] Drop updates `status` (and `updated`) in the file, nothing else changes
- [ ] Write lands within 100 ms of drop
- [ ] Failed write rolls the card back and surfaces an error
- [ ] Keyboard alternative exists (move card via menu/shortcut)

## Notes

## Log

- 2026-07-16 created from concept breakdown
