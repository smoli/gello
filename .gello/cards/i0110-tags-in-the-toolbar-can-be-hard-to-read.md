---
id: i0110
title: Tags in the toolbar can be hard to read
status: review
type: issue
ref: c0058
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:41:26
---

![image](../assets/i0110/image.png)

## What

Unselected tag chips in the board toolbar filter drew the tag colour as their
text on a transparent chip, sitting over an arbitrary board background photo.
Bright tags (green, sky, amber) had poor contrast and were hard to read.

## Acceptance criteria

- [x] An unselected toolbar chip has an opaque backing so its label is legible
  over any board background (not transparent-over-photo).
- [x] The label uses a contrast-picked text colour, not the raw tag colour.
- [x] The tag colour is still visible for identity (chip border + tinted fill).
- [x] A selected chip keeps its full-colour fill with readable text.

## Notes

- Root cause: `Board.tsx` styled unselected chips as `{ borderColor: colour,
  color: colour }` on a transparent button — the raw tag colour as text over
  the board photo.
- Fix: both states now get an opaque fill. Selected = the full tag colour;
  unselected = a pale tint of it (`tintColor`, 82% toward white), with the tag
  colour kept as the border. Text is `readableTextColor(fill)` in both states,
  so contrast is guaranteed regardless of the background.
- Added a pure `tintColor(hex, amount)` helper to `lib/tags.ts` (mix toward
  white), reusing a shared `parseHex`; `readableTextColor` was refactored onto
  it. Unit-tested in `tags.test.ts`; the chip styling is covered in
  `Board.test.tsx`.
- The one-line `Board.css` cleanup (dropping the now-dead
  `button.tag-chip { background: transparent }`) was swept into commit c7cf905
  by a parallel i0111 auto-commit; inline fills win regardless, so it is
  correct in the tree, just mislabelled.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 fixed unselected toolbar chip contrast (opaque tinted fill +
  readable text); added `tintColor` helper with tests (agent)
- 2026-07-20 status → review (agent)
