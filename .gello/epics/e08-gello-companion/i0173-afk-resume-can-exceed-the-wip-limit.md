---
id: i0173
title: AFK resume can exceed the WIP limit
status: in-progress
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T10:06:24
epic: e08
usage-tokens: 6779
usage-cost: 1.127072
---

## What

Under AFK a parked run gives up its WIP slot ([[c0163]]) and the next card takes
it. When the human then answers, the resume dispatches at once — it never went
through `planDispatch` — so the board runs one over its limit until one of the
two ends. Several parked cards answered together multiply that.

Resolved: a resume now takes a slot like any other run. A card that gave its
slot away waits for a free one; a card that kept its slot (AFK off) resumes at
once, as before.

## Acceptance criteria

- [x] A resume costs budget only when the card gave its slot away — with AFK off
      an answer still resumes immediately.
- [x] With no free slot the answered card is not resumed, and its `awaiting:
      answered` marker is left on the card so a later sync retries it.
- [x] A held resume is reported once, as `answered, waiting for a slot`.
- [x] The freed slot goes to the answer, not to a `ready` card: resumes are
      planned before dispatch.
- [x] Several answers arriving together share one budget, in board order —
      they no longer take a slot each.

## Discussion

Asked whether a resume should wait for a slot, stay immediate, or overshoot by
at most one. Human chose the full gate (option B): a resume waits. The bounded
one-run overshoot (C) and documenting the status quo (A) were rejected.

Reporting a waiting resume truthfully in the app needs a new run phase — split
out as [[i0177]], since the published phase stays `waiting-for-input` and the
card keeps showing "needs input" after the answer landed.

## Notes

- Where it was: `Runner.sync` called `maybeResume` for every answered card,
  which started the run with no budget check.
- The overshoot never compounded. A resumed run leaves `slotFreed` (its phase is
  `running` again), so `occupiedSlots` counts it and fresh dispatch drops to 0
  until it ends. Only more answers added more overshoot.
- The gate is not AFK-conditional: a resume needs budget only when the card does
  not already hold a slot, which under AFK off is never true. `occupiedSlots`
  was split so the gate can ask *which* cards hold one (`occupiedSlotIds`).
- A held resume needs no new trigger: the marker is only cleared by
  `maybeResume`, so the next sync retries — including the one `handleExit` runs
  when a slot frees.
- Deliberate test change: "still resumes the parked card when the human answers"
  pinned the old immediate-resume decision. Replaced, not weakened — the new
  describe asserts the opposite behaviour the human chose.

## Log

- 2026-08-09 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 asked the human which way to resolve it; answered: gate the resume
- 2026-08-09 resume gate + held-back line, companion README updated, [[i0177]] filed
