---
id: c017
title: Initialize a board in a fresh repo
status: backlog
milestone: m05
priority: normal
depends: [c016]
tags: [core]
created: 2026-07-16
updated: 2026-07-17
order: 60
---

## What

Scaffold `.gello/` (board.yaml, empty concept.md, inbox/, milestones/,
assets/) in a repo that has none, and offer to append the agent-workflow
convention snippet to the repo's CLAUDE.md (create if absent).

## Acceptance criteria

- [ ] Scaffold matches the layout in concept.md §4
- [ ] Existing CLAUDE.md is appended to, never overwritten
- [ ] Existing `.gello/` is never touched by init
- [ ] Freshly initialized board renders immediately

## Notes

## Log

- 2026-07-16 created from concept breakdown
