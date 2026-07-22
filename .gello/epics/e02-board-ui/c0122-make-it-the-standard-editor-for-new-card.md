---
id: c0122
title: Make it the standard editor for new cards
status: done
ref: c0116
epic: e02
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T08:49:47
---

Also when using the + New Idea button the editor is not vertically aligned

## What

The c0116 editor stops being a second state to reach: every new card opens in
it. The corner panel and the grow-on-focus step are gone — ⌘N/⌘I/⌘E, the three
capture buttons, report-issue and follow-up all open the same centred editor.

## Acceptance criteria

- [x] Every capture opens directly in the full editor — no focus step
- [x] The editor is centred, both axes, from the + New idea button
- [x] All entry points share it: the three buttons, ⌘N/⌘I/⌘E, report-issue,
      follow-up
- [x] Nothing is written to disk until Add
- [x] The Escape guard, image paste, and Enter/mod+Enter keep working

## Notes

- **The misalignment was a specificity collision.** `App.css` had
  `.app-shell-frameless .quick-capture { top: calc(0.7rem + titlebar) }` — two
  classes, so it outranked c0116's single-class `.quick-capture-expanded
  { top: 50% }`. The panel kept its corner `top` but still got
  `translateY(-50%)`, so it hung half off the top edge. Only the frameless
  shell (the real app) has that rule, and jsdom applies no CSS, which is why
  no test saw it.
- Fixed by removing the fight rather than winning it: the panel positions
  nothing now: a `.capture-overlay` flex-centres it, which is what the
  report-issue draft (c040) already did. `.issue-draft-overlay` is folded into
  it, so `App.tsx` no longer wraps `CaptureForm` — the form brings its own
  overlay and all callers get the same treatment.
- The c0116 `expanded` state and its `onFocus` trigger are deleted, not
  defaulted to true, and the tests asserting the small→large transition are
  replaced by ones asserting every capture opens in the editor. That is a
  deliberate spec change from this card, not a weakened test.
- Consequence worth knowing: the overlay dims the board and takes clicks
  while a capture is open, where the old corner panel left the board usable.
  Clicking the scrim does nothing — closing is still Escape or Cancel.

## Log

- 2026-07-22 status → in-progress (agent)
- 2026-07-22 capture opens in the editor for every entry point; centring moved
  to a shared overlay, which is what the alignment bug was
- 2026-07-22 status → review (agent)
- 2026-07-22 status → done (app)
