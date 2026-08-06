---
id: i0138
title: The glimpse line sometimes vanishes
status: in-progress
type: issue
ref: c0109
epic: e08
created: 2026-08-06
updated: 2026-08-06
status-changed: 2026-08-06T17:29:55
---

That’s visually unpleasing as the card size changes which is very wisible when whatching the board. Always keep something their. Either „thinking“ instead of nothing or the last message.

## Investigation & fix (agent, 2026-08-06)

**Cause: the park transition.** While a run is `running` the state file always
carries the run + its activity (sampled the live file five times — steady), so
the line does not flicker mid-run. It vanished when the agent **asked a
question**: the run becomes `waiting-for-input`, and c0109 deliberately dropped
the activity from a parked run's state entry (the needs-input badge "covers" it)
and `cardActivity` returned null for a non-`running` run. So the glimpse line
disappeared and the card shrank — reproducible whenever the agent parks, which
in this Q&A-heavy workflow is "sometimes".

**Fix — keep a line for any live run** (running or parked), the reporter's "keep
the last message / Thinking":

- **Companion** publishes the latest tool for a `waiting-for-input` run too, not
  only `running` — so the app has the last message ("Asking a question").
- **App** `cardActivity` returns a line for a running *or* parked run, marking a
  parked one `waiting`. The card renders a waiting line **still** (a muted italic
  "paused" look, no busy sweep — motion means actively-working), beside the
  needs-input badge. The line no longer vanishes, so the card holds its size.

Reverses the c0109 "parked → no line" decision (and its two tests), which this
issue supersedes.

**Not addressed** (no repro, separate rarer cause): if a poll's
`readCompanionState` ever failed transiently, `runner` would briefly go null and
*every* line would blink. Atomic state writes make that unlikely, and it was not
the reported symptom; left as a possible follow-up if it is ever seen.

## Log

- 2026-08-06 status → in-progress (agent)
- 2026-08-06 status → ready (app)
- 2026-08-06 status → in-progress (agent)
- 2026-08-06 (agent) fixed: the glimpse vanished when a run parked. The
  companion now publishes a parked run's last activity, and the app keeps the
  line for a parked card (a still "waiting" line, no sweep) so it never
  disappears and the card holds its size. 1397 tests, typecheck, lint and both
  builds green.
- 2026-08-06 (agent) implemented and committed: companion publishes a parked
  run's last activity (`46976db`); the app keeps a still "waiting" line for a
  parked run (`436efcf`). Verified: sampled the live state file (steady while
  running, so park was the only vanish), 1397 tests, typecheck, lint and a
  production build all green.
