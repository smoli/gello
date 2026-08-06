---
id: i0136
title: Suggestions behind other UI
status: in-progress
type: issue
ref: c0145
epic: e03
created: 2026-08-06
updated: 2026-08-06
status-changed: 2026-08-06T05:47:57
---

![image](../../assets/i0136/image.png)

## What

The tag suggestion list (c0145) draws behind the card detail UI below it: the
"Add dependency" input and its label sit on top of the list, and the body text
shows through it.

## Acceptance criteria

- [x] The suggestion list draws above everything below it in the card detail
- [x] The list is opaque — nothing behind it shows through
- [x] A regression test pins the cause, so a later style change cannot bring it
      back unnoticed

## Notes

- Cause: `opacity: 0.9` on `.card-detail-fields label`. An opacity below 1 makes
  the element a stacking context, so the list's `z-index: 5` could only be
  compared against its siblings inside the label, never against the positioned
  elements further down the dialog. The label carries no z-index of its own, so
  DOM order decided and everything after it drew on top. The same 0.9 painted
  the list at 90% opacity — that is the body text bleeding through.
- Fix: dim the label text with `color: color-mix(in srgb, CanvasText 90%,
  transparent)` instead. It affects the text alone and starts no stacking
  context. The controls inside the label set their own `color`, so they are
  unchanged apart from no longer being dimmed by the wrapper.
- Test: `src/components/suggestion-stacking.test.ts` reads the stylesheet, the
  way the i0120 drag tests do — jsdom does no layout or painting, so a rendered
  assertion passes either way. It fails on any stacking-context property
  (`opacity`, `transform`, `filter`, `isolation`, …) on any element between the
  list and `.card-detail-backdrop`, and on a missing z-index.
- Verified by the stylesheet test and the CSS stacking rules, not by looking at
  the running app — worth a glance when the app is next open.

## Log

- 2026-08-06 status → in-progress (agent)
- 2026-08-06 traced to the label's `opacity: 0.9` stacking context; dimmed with
  `color` instead, pinned by 6 stylesheet tests
