---
id: i0157
title: Countdown does not show for cards created in ready
status: review
type: issue
ref: c0117
epic: e08
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T10:46:07
usage-tokens: 26114
usage-cost: 4.111059
---

If the card is created with its initial status being ready, the countdown does not show.

## Acceptance criteria

- [x] A card created straight in the trigger status shows the pickup countdown
      on its front, even though it has no `status-changed`
- [x] The countdown runs the same window the companion actually waits — its
      first-seen clock (i0124), published in the state file
- [x] A real `status-changed` still wins over the published clock, matching the
      companion's own order
- [x] With no clock published (an older companion, a card it has not seen),
      nothing is shown — no invented window
- [x] The blocked / no-free-slot / already-running rules still hide it
- [x] The clock is dropped when the card leaves the trigger status, so the
      countdown restarts if it comes back

## Notes

- 2026-08-08 (agent) i0124 already fixed the companion half: a card with no
  `status-changed` serves its grace period timed from when the companion first
  saw it. That clock was in the runner's memory only, so the card front had
  nothing to count down and the window passed silently — the leftover i0124
  named, and this card.
  - **Fix**: `Runner.firstSeenAt()` renders the clocks as local ISO datetimes
    and `publish()` writes them into `state.json` as `firstSeen`.
    `pickupCountdown` falls back to that entry when the card has no usable
    `status-changed`, keeping the stamp first — the same order as
    `pickupWait` on the companion side, so the two never disagree.
  - `firstSeen` is optional on both `CompanionState` types. It is a map, so
    absent and empty mean the same thing to every reader, and an older
    companion's file stays valid — unlike c0117's required `pickupDelay`,
    where `undefined` could have reached the arithmetic.
  - Rejected: writing `status-changed` when a card is created. It would fix
    only cards the app creates; an agent writing a card straight into `ready`
    (the i0124 case) would still count down invisibly.
  - `nowIsoDateTime` split into `isoDateTime(date)` + a now wrapper, so the
    runner can format an injected fake-clock instant.
- **Verified live**: scratch board, one card in `ready` with no
  `status-changed`, `pickupDelay: 10`, companion killed after 4s. The state
  file showed `firstSeen: { c001: … }` with `runs: []`.

## Log

- 2026-08-08 status → ready (app)
- 2026-08-08 status → in-progress (agent)
- 2026-08-08 (agent) published the companion's first-seen pickup clock in
  `state.json` and made the card front's countdown fall back to it. 10 new
  tests; 1552 frontend tests, typecheck and lint green.
- 2026-08-08 status → review (agent)
