---
id: c0117
title: Have a delay for a companion before picking up a card
status: in-progress
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T07:20:28
epic: e08
---

## What

Drag a card to `ready` by mistake and the companion dispatches an agent within
a poll cycle — real work, real tokens, on a card you did not mean to start.
(This happened to c0116 and cost a killed companion to stop.)

Give the companion a **grace period**: a card must sit in the trigger status
for a configurable delay — **default 10s** — before it is dispatched. Drag it
back out inside that window and nothing ever runs. When a companion is
attached, the card front shows a **countdown**, so the window is visible rather
than invisible.

**Resumes are not delayed.** The grace period guards against an accidental
*drag*; answering a parked question is a deliberate act you just performed, and
delaying it would put a pause into every turn of the c0096/c0102 Q&A loop.
Fresh pickups wait; resumes fire immediately.

**Mechanism — nothing new is needed:**

- **When did it enter?** `status-changed` already records it, so eligibility is
  just `now - status-changed >= pickupDelay`. No new state on the card.
- **Waking up.** The watcher will not fire again while the card sits
  untouched, so the runner must re-check on a timer — the injectable
  `Scheduler` in `companion/throttle.ts` already exists (and being injectable,
  the delay is testable with a fake clock rather than a real 10s wait).
- **Config.** `pickupDelay` joins `CompanionConfig` (c0099) with the
  established `companion.yaml` + env-override pattern; `0` restores today's
  immediate behaviour.
- **Countdown.** The companion publishes the delay in its state file; the app
  already knows `status-changed` and `isCompanionLive`, so the countdown ticks
  **client-side** each second with no extra polling — the same trick as c0109's
  activity line.

Cancelling needs no special handling: a card dragged out of the trigger status
simply stops being a candidate, and dragging it back refreshes `status-changed`
so the countdown restarts.

## Acceptance criteria

- [ ] A card entering the trigger status is not dispatched until `pickupDelay`
      has elapsed since its `status-changed`
- [ ] `pickupDelay` is configurable via `companion.yaml` and an env override
      (c0099 pattern), defaulting to 10s; `0` dispatches immediately
- [ ] A card moved out of the trigger status within the window is never
      dispatched
- [ ] Moving it back in restarts the countdown
- [ ] A card left untouched still dispatches once its delay elapses — the
      runner re-checks on a timer rather than waiting for another file change
- [ ] Resuming a parked card (its question was answered) is **not** delayed
- [ ] A card whose `status-changed` is missing or unparseable is treated as
      eligible, never blocked indefinitely
- [ ] The configured delay appears in the companion state file
- [ ] With a companion live, a waiting card's front shows a countdown; with no
      companion attached, nothing is shown
- [ ] The WIP limit still applies — the delay is an additional gate, not a
      replacement
- [ ] The delay is unit-tested with a fake scheduler (no real-time waiting)

## Discussion

- **No delay on resume** (human's call): the hazard is an accidental drag, and
  you cannot accidentally answer a question. A uniform delay would tax the Q&A
  loop every turn. Rejected: delaying everything, and a second config knob for
  a resume delay that would only ever be set to zero.
- **Delay only; abort is its own card** (human's call). The grace period covers
  the common case — you notice within seconds. It does **not** cover the rest:
  *today, moving a card back does not recall an already-dispatched agent*
  (exactly what forced killing the companion during the c0116 accident).
  Stopping an in-flight run raises partial-work and process-control questions
  and deserves its own discussion — split out as [[c0119]]. Rejected here:
  auto-recall on drag-out, and an explicit stop control (which also overlaps
  c0112's deferred control keys).
- **Reuse over new state**: `status-changed` answers "how long has it waited",
  `throttle.ts`'s `Scheduler` answers "wake me later", `CompanionConfig`
  answers "how long", and `isCompanionLive` answers "is anyone watching".
- **Missing `status-changed` → eligible**: a card lacking the field is not a
  fresh drag, and blocking it forever would be worse than dispatching it.
- **Open**: whether a "start now" affordance should let you skip the wait
  deliberately; the countdown's presentation — this is the *second* live-ticking
  element on a card front after c0113's activity sweep, so the two should feel
  like one system rather than two unrelated animations.

## Log

- 2026-07-22 status → discuss (app)
- 2026-07-22 discussed (human): grace period before dispatch (default 10s,
  configurable, `0` = today's behaviour) keyed off `status-changed` and
  re-checked via the existing `Scheduler`; countdown on the card front when a
  companion is attached; resumes exempt; recalling an already-dispatched agent
  deliberately left to its own card.
- 2026-07-22 status → backlog (app)
- 2026-07-22 status → ready (app)
- 2026-07-22 status → in-progress (agent)
