---
id: c015
title: Concurrent-edit policy (last-write-wins, no silent loss)
status: backlog
milestone: m04
priority: normal
depends: [c010, c014]
tags: [core]
created: 2026-07-16
updated: 2026-07-17
order: 40
---

## What

Define and implement the concurrency rules: app state is always derived from
disk; the only transient state is the active field edit. If the file under an
active edit changes externally, the user is prompted (keep mine / take disk),
never silently overwritten in either direction.

## Acceptance criteria

- [ ] Documented policy in concept.md §8 matches implementation
- [ ] External change during active edit → prompt, both choices tested
- [ ] No path exists where a stale in-memory card overwrites newer disk state
- [ ] Status drag during external edit of the same card merges (status from
      app, body from disk) — the field-level LWW case, tested

## Notes

## Log

- 2026-07-16 created from concept breakdown
