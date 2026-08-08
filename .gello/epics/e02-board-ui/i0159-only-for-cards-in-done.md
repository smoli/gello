---
id: i0159
title: Only for cards in Done
status: review
type: issue
ref: c0160
epic: e02
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T12:27:29
---

## What

c0160 put the ✓ "Mark done" button on every card front in the activity view.
It belongs on review cards only — the same work the done drop area takes.

## Acceptance criteria

- [x] A review card front offers the done button
- [x] A ready or in-progress card front offers none
- [x] Clicking it still sets the card `done` in its own project without opening
      the detail

## Notes

- Read "in Done" as "the cards that go to done", i.e. the review column — the
  view has no done column, and c0160's own note argued the other way.
- The guard is on the render, not on `markDone`: the drop path already refuses
  anything but review, so both entrances agree.
- The c0160 test that set an in-progress card done from its front was replaced;
  its two other claims (no detail opens, the card leaves the view) moved onto
  the review card.

## Log

- 2026-08-08 status → in-progress (agent)
- 2026-08-08 built: the done button renders only for `status: review` cards.
- 2026-08-08 status → review (agent)
