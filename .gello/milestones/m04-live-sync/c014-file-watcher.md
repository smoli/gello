---
id: c014
title: File watcher with debounced board reconciliation
status: backlog
milestone: m04
priority: high
depends: [c003, c005]
tags: [core, rust]
created: 2026-07-16
updated: 2026-07-16
---

## What

Rust `notify` watcher on `.gello/` emits change events to the frontend; the
board reconciles (re-parse changed files only, debounced) without a full
reload. This is the "watch the agent work" feature.

## Acceptance criteria

- [ ] External status edit moves the card on the board without reload
- [ ] New/deleted card files appear/disappear
- [ ] Burst of changes (agent editing many files) coalesces into one refresh
- [ ] Self-inflicted writes don't cause redundant re-renders or loops
- [ ] board.yaml changes re-render columns

## Notes

## Log

- 2026-07-16 created from concept breakdown
