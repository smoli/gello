---
id: i0173
title: AFK resume can exceed the WIP limit
status: in-progress
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T10:06:24
epic: e08
---

## What

Under AFK a parked run gives up its WIP slot ([[c0163]]) and the next card takes
it. When the human then answers, the resume dispatches at once — it never went
through `planDispatch` — so the board runs one over its limit until one of the
two ends. Several parked cards answered together multiply that.

Deliberate for now: holding the human's answer behind an unrelated run is worse
than a brief overshoot. Decide whether a resume should instead wait for a slot
(and how a waiting resume is reported), or stay immediate.

## Notes

- Where it happens: `Runner.sync` calls `maybeResume` for every answered card
  before `planDispatch`, and `maybeResume` starts the run with no budget check
  (`companion/runner.ts:556`, `companion/runner.ts:786`).
- The overshoot does not compound. A resumed run leaves `slotFreed` (its phase
  is `running` again), so `occupiedSlots` counts it and the budget for fresh
  dispatch drops to 0 until it ends. Only *more answers* add more overshoot:
  N parked cards answered together while N slots were re-let run limit + N.
- A gate would be precise, not AFK-conditional: a resume needs budget only when
  the card is in `slotFreed` — i.e. an AFK-parked run that gave its slot away.
  With AFK off a parked run kept its slot, so its resume costs nothing.
- A queued resume needs no new trigger: the resume trigger is `awaiting:
  answered` on disk, so not clearing the marker makes the next `sync` retry it,
  and `handleExit` syncs when a run ends (`companion/runner.ts:996`).
- Open: how a waiting resume is reported. Cheap version is a held-back log line
  (`reportHeldBack`); the run's published phase stays `waiting-for-input`, which
  the app renders as "needs input" — misleading once the answer is in. A truthful
  badge means a new run phase and app work, so probably its own card.

## Log

- 2026-08-09 status → ready (app)
- 2026-08-09 status → in-progress (agent)
