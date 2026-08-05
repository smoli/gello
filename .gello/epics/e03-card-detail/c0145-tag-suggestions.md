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

- [x] Typing in the Tags field suggests matching tags already in use on the board
- [x] The suggestion list matches the segment the caret is in, not the whole field
- [x] Tags already listed in the field are not suggested again
- [x] An empty segment (fresh field, or right after a comma) offers the unused tags
- [x] Picking a suggestion (click or Enter) completes that segment and leaves the
      caret ready for the next tag
- [x] Arrow keys move the highlight; Escape drops the suggestions without closing
      the card dialog
- [x] A board with no tags yet shows no suggestion list

## Notes

- The add-dependency picker (c0127) is the precedent — same listbox/option
  markup, keyboard handling, and highlight class naming.
- The card carried no acceptance criteria; they were written from the one-line
  What before any code, and drive the tests.
- Matching is on the entry the caret is in, so a tag edited in the middle of
  `a, b, c` gets its own completions. Three pure helpers in `src/lib/tags.ts`
  carry it: `tagSegmentAt`, `suggestTags`, `applyTagSuggestion`.
- Suggestion order is prefix matches first, then matches from the middle;
  an entry typed out in full drops off the list — nothing left to complete.
- Taking a suggestion normalizes the whole field to `a, b` separators and adds
  a trailing `, ` when the completed tag is the last one. The caret is restored
  in a microtask, after React has rendered the new value.
- The list only shows while the field has focus; suggestion buttons cancel the
  mousedown so the blur-commit does not close the list before the click lands.
- Ranking by card count was considered and dropped: a board's tag list is short,
  and alphabetical is stable while typing.
- Not verified in the running app — the dropdown reuses the c0127 picker's CSS
  shape and is covered by component tests only.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 tag type-ahead in the card detail Tags field, on three pure helpers
  in `lib/tags.ts`; 13 component tests + 15 helper tests
