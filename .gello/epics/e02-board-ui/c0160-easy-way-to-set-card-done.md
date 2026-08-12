---
id: c0160
title: Easy way to set card done
status: done
ref: c0138
epic: e02
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T12:28:17
usage-tokens: 15434
usage-cost: 1.920964
---

Right now, in the overview user needs to set status via card detail

## What

A one-click done control on every card front in the activity view (c0138). The
view's only way to finish a card was the done drop area, which takes reviewed
work and takes it by drag — anything else meant opening the detail and changing
its Status field.

The control writes to the card's own project, through the same rebase + atomic
write every other cross-project edit uses.

## Acceptance criteria

- [x] Every card front in the activity view offers a done button
- [x] Clicking it sets that card `done` in its own project, stamping
      `status-changed`
- [x] It works from any column the view shows, not just review
- [x] The click does not open the card's detail
- [x] The write rebases on the owning project's disk bytes first
- [x] The card leaves the view once it is done

## Notes

- **The button is on every card, not only review ones.** The card names the
  detail trip as the problem, and a review card already had the drop area — so
  the cards that had no way out at all were the ready/in-progress ones. The
  drop area keeps its review-only guard: its label offers accepting reviewed
  work, which is a narrower thing than finishing a card.
- Hidden until the card is hovered or holds focus, with `visibility` rather
  than `opacity` — a transparent button still takes the click, and an accidental
  one finishes a card.
- `accept()` (the drop) now delegates to `markDone()`, so both paths are one
  write.
- **Deliberate test change**: the c0157 test "marks a dependency no card on that
  board carries" asserted no button anywhere on the card front, as a proxy for
  the dependency line naming nothing to open. It now queries within the status
  line, which is what it was about.

## Log

- 2026-08-08 status → in-progress (agent)
- 2026-08-08 built: a "Mark done" button on the activity-view card front,
  writing `done` to the card's own project through `markDone`.
- 2026-08-08 status → review (agent)
- 2026-08-08 status → done (app)
