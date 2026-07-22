---
id: c0119
title: Stop an in-flight companion run
status: discuss
epic: e08
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T07:05:00
---

## What

Once the companion has dispatched an agent, there is no way to stop **that one
run**. Moving the card back out of `ready`/`in-progress` does not recall the
agent — it keeps working, keeps writing files, and keeps spending tokens. The
only lever today is killing the companion process, which stops **every** run
including ones you wanted.

This surfaced concretely on 2026-07-22: c0116 was dragged to `ready` by
accident, an agent was dispatched, and moving the card straight back to
`discuss` changed nothing — the agent carried on and had to be killed at the
process level.

[[c0117]] adds a grace period before pickup, which covers noticing within
seconds. This card covers the rest: noticing *after* the run has started.

**Two ways to stop a run:**

- **Drag it out.** Moving a card out of its running status stops that run —
  card position is the source of truth, which is what you instinctively reach
  for. Because this makes a drag *destructive*, it **asks first** whenever a
  run is live ("stop the running agent?"). The dialog only appears when there
  is something to lose, and it restores the symmetry with [[c0117]], which
  protects the accidental drag *in* with a grace period.
- **An explicit stop**, in the c0100 runs popover (and later a TUI key, which
  c0112 deferred). Unambiguous intent, and the natural home is the surface that
  already lists the runs.

**The aftermath is mostly already built.** `nodeSpawner` holds the child
handle, so exposing a kill is a few lines; a killed process then exits non-zero
and flows through `classifyExit` → the run is dropped and the card is left
exactly as the agent left it. That is c0097's recoverable-crash path: partial
edits stay on disk, untouched and yours to keep or discard. Nothing is cleaned
up automatically, and nothing is clobbered.

**A stop is not a failure.** A killed run currently classifies as `error`,
indistinguishable from a genuine crash. It gets a distinct **`aborted`** phase
so `error` keeps meaning "something went wrong" and deliberate stops stop
crying wolf in the runs popover and `runs.log`.

**The card is left where it is.** The companion does not rewrite card status —
the epic's standing boundary. An aborted card usually sits in `in-progress`
until you move it; the c0100 indicator and the activity line already show that
no run is live.

**The session survives.** The session id stays in `sessions.json`, so putting
the card back into `ready` resumes the *same* agent with everything it had
already learned, rather than re-paying a cold start on a half-done card.

## Acceptance criteria

- [ ] `SpawnedRun` can be killed, and the real spawner implements it
- [ ] An explicit stop in the app's runs popover ends that run and no other
- [ ] Moving a card out of its running status stops that run
- [ ] A drag that would stop a live run asks for confirmation first; declining
      leaves the run untouched
- [ ] Dragging a card with no live run is unaffected — no dialog
- [ ] A stopped run is reported with an `aborted` phase, distinct from `error`
- [ ] `aborted` appears in the state file and is parsed defensively by the app
- [ ] Stopping one run leaves every other run alive
- [ ] The card is not rewritten by the stop — its status and body are exactly
      as the agent left them
- [ ] Files the agent had already written are left on disk, unmodified
- [ ] The session id is retained, and re-dispatching the card resumes that same
      session
- [ ] The companion stays alive and keeps watching after a stop

## Discussion

- **Both triggers** (human's call): drag-out matches the instinct that the
  board drives the companion; the explicit control gives unambiguous intent
  where a drag would be guesswork.
- **Confirm on destructive drag** (human's call). Accepted asymmetry, made
  deliberate: [[c0117]] protects an accidental drag *in* with a silent grace
  period, while an accidental drag *out* is guarded by a dialog — because the
  cost is different. Starting unwanted work wastes tokens; stopping wanted work
  destroys it. Rejected: killing immediately with no guard (a mouse slip
  destroys real work — the exact class of accident this epic keeps hitting) and
  a c0117-style grace period on the way out (the agent keeps working and
  spending during the window, and it is more timing machinery for less safety).
- **`aborted` ≠ `error`** (human's call): without it, every deliberate stop
  reads as a failure and erodes the signal when something genuinely breaks.
- **Card left as-is** (human's call): keeps the companion out of card status,
  consistent with the crash path. Rejected: reverting to the pre-dispatch
  status, which would cross that boundary and require remembering prior state
  across a restart.
- **Session kept** (human's call): a stopped card resumes warm. Rejected:
  discarding it, which throws away context already paid for and risks redoing
  work on a half-finished card.
- **Most of the mechanism exists**: the kill is a small addition to the spawner
  interface; the consequences already work end to end via `classifyExit`.
- **Open**: whether "stop" should eventually grow into pause/resume (out of
  scope here); whether the CLI needs a stop verb, or the app plus the TUI key
  are enough.

## Log

- 2026-07-22 split out of the [[c0117]] discussion, which deliberately scoped
  itself to the pre-dispatch grace period and left aborting a live run here.
- 2026-07-22 discussed (human): both triggers (drag-out, which confirms when a
  run is live, and an explicit stop in the runs popover); a distinct `aborted`
  phase rather than `error`; the card left exactly as the agent left it; the
  session retained so a re-dispatch resumes warm.
