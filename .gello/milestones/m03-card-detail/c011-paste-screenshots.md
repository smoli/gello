---
id: c011
title: Paste/drag screenshots into a card
status: backlog
milestone: m03
priority: high
depends: [c009]
tags: [ui, rust]
created: 2026-07-16
updated: 2026-07-16
---

## What

⌘V with an image on the clipboard (or dragging an image file) into a card
detail saves it to `.gello/assets/<card-id>/` and inserts a relative Markdown
image link at the cursor. Images render inline.

## Acceptance criteria

- [ ] Clipboard image lands as PNG in `.gello/assets/<card-id>/` with a
      readable, collision-free filename
- [ ] Relative link inserted resolves both in-app and on GitHub
- [ ] Dragged image files work the same way
- [ ] Inline rendering in card detail
- [ ] Non-image paste is untouched (normal text paste)

## Notes

## Log

- 2026-07-16 created from concept breakdown
