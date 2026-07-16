---
id: c021
title: Create new cards in the app
status: backlog
priority: normal
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

A "New card" action in the board UI that creates a card file — with title
(required) and optional milestone, status, priority, and body. The full,
deliberate flavor of card creation, complementing c013's frictionless
quick-capture (title-only → inbox).

Relation to c013: c013 optimizes for capture speed (idea → inbox, no
decisions); this card is for when you already know where the work belongs
(e.g. "new card in m03, ready, high"). Both should share one create-card
mechanism: next free ID from the board model (c003's `nextCardId`), filename
`c0XX-slugified-title.md`, frontmatter scaffold matching concept.md §4,
atomic write.

Possible triage outcomes: fold into c013 as one card, or keep separate and
build the shared mechanism here first. Decide at triage.

## Acceptance criteria

- [ ] "New card" action reachable from the board toolbar
- [ ] Title required; milestone, status, priority, body optional with
      sensible defaults (inbox/backlog/normal/empty)
- [ ] Created file gets the next free ID and a valid frontmatter scaffold
- [ ] New card appears on the board immediately after creation
- [ ] Created file parses cleanly (dogfood test stays green)

## Log

- 2026-07-16 captured to inbox (requested by Stephan: "We need a new card:
  Creating a new card ;-)")
