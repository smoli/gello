---
id: c0145
title: Tag suggestions
status: in-progress
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T12:55:59
epic: e03
---

## What

Adding a tag manually to a card should provide suggestions while typing. The
card detail Tags field is a comma-separated free-text input: typing into it
offers the tags already in use on the board, so the same label is not spelled
three ways.

## Acceptance criteria

- [ ] Typing in the Tags field suggests matching tags already in use on the board
- [ ] The suggestion list matches the segment the caret is in, not the whole field
- [ ] Tags already listed in the field are not suggested again
- [ ] An empty segment (fresh field, or right after a comma) offers the unused tags
- [ ] Picking a suggestion (click or Enter) completes that segment and leaves the
      caret ready for the next tag
- [ ] Arrow keys move the highlight; Escape drops the suggestions without closing
      the card dialog
- [ ] A board with no tags yet shows no suggestion list

## Notes

- The add-dependency picker (c0127) is the precedent — same listbox/option
  markup, keyboard handling, and highlight class naming.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
