---
id: c003
title: Board loader — .gello tree to board model
status: backlog
milestone: m01
priority: high
depends: [c002]
tags: [core]
created: 2026-07-16
updated: 2026-07-16
---

## What

Scan a `.gello/` directory into one BoardModel: config, milestones (with their
cards), inbox cards, invalid cards. Pure function over an abstract FS
interface so it's testable without Tauri.

## Acceptance criteria

- [ ] Loads this repo's own `.gello/` tree correctly (fixture copy)
- [ ] Inbox cards, milestone cards, and invalid cards are all represented
- [ ] Cards without a parseable ID still surface as invalid entries
- [ ] Deterministic ordering (by priority, then id) for board rendering
- [ ] Next free card ID / milestone ID can be derived from the model

## Notes

## Log

- 2026-07-16 created from concept breakdown
