---
id: c0125
title: Don’t show the countdown, if the card is blocked
status: review
ref: c0117
epic: e08
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T21:21:55
---

But show it after the block is gone

## Notes

- 2026-07-22 (agent) **The defect.** c0123 set the card-front precedence to
  activity → countdown → blocked, so a *blocked* card in the trigger status
  showed "picking up in 7s" and hid the "waiting on …" line. The companion never
  picks such a card up: `planDispatch` gates on `depends` before the grace
  period, and puts it in `blocked`, not `dispatch`. The countdown was promising
  something that could not happen, and hiding the reason.
- **Fixed where the rule lives**, not in the component: `pickupCountdown` takes a
  `blocked` flag and returns null. Whether a countdown exists is that function's
  one job; the component stays free of branching. The flag is passed in rather
  than derived there — `pickup.ts` knows the companion's state, not the board.
- **An edge the obvious fix would have missed.** The natural move is to reuse
  c0123's `blockersFor`, but that is gated to `{ready, in-progress}`. The
  companion's trigger status is configurable (c0099), so with `trigger: backlog`
  a blocked backlog card would still have counted down. Split the rule instead:
  `openDependencies` is the dependency check with no status gate, and
  `blockersFor` is that plus the gate. One rule, two policies about where it
  applies — which also keeps the app's rule identical to the companion's
  `missingDepends`.
- **One c0123 test reversed deliberately**, as its own step rather than quietly:
  "the pickup countdown takes the slot ahead of blocked" pinned exactly the
  behaviour this card overturns. It now asserts the opposite and says why.
- **Pre-existing red on `main`, not from this card**: `Board.tsx`'s c0121
  follow-up-hover wiring fails `tsc` (`hoveredPath`, `revealFollowUp`, `onHover`)
  along with 4 c0121 tests, and `demo/holzhof-board.test.ts` has one failure.
  All four reproduce on a clean checkout with this card's changes stashed, so
  they are untouched here — deliberately, since c0121 looks mid-edit and
  "fixing" it could clobber work in progress. This card's own files are green.

## Log

- 2026-07-22 status → in-progress (agent)
- 2026-07-22 (agent) fixed: `pickupCountdown` takes a `blocked` flag and returns
  null; `openDependencies` split out of `blockersFor` so the check is not
  status-gated (a custom trigger would otherwise still have counted down on a
  blocked card). One c0123 precedence assertion reversed on purpose. Noted a
  pre-existing red on `main` from c0121 that this card leaves alone.
- 2026-07-22 status → review (agent)
