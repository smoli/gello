---
id: c010
title: Inline body editing
status: ready
milestone: m03
priority: normal
depends: [c009]
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Edit the card body in place (plain Markdown textarea or light editor). Save on
blur/⌘S. Never hold unsaved state longer than the active edit — the watcher
may bring external changes.

## Acceptance criteria

- [ ] Edit → save persists body, frontmatter untouched
- [ ] Escape cancels, restoring the on-disk content
- [ ] External file change during an active edit is surfaced, not clobbered

## Notes

## Log

- 2026-07-16 created from concept breakdown
