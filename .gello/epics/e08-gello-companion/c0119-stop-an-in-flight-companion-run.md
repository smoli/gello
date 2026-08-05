---
id: c0119
title: Stop an in-flight companion run
status: review
epic: e08
created: 2026-07-22
updated: 2026-08-05
status-changed: 2026-08-05T12:44:58
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

- [x] `SpawnedRun` can be killed, and the real spawner implements it
- [x] An explicit stop in the app's runs popover ends that run and no other
- [x] Moving a card out of its running status stops that run
- [x] A drag that would stop a live run asks for confirmation first; declining
      leaves the run untouched
- [x] Dragging a card with no live run is unaffected — no dialog
- [x] A stopped run is reported with an `aborted` phase, distinct from `error`
- [x] `aborted` appears in the state file and is parsed defensively by the app
- [x] Stopping one run leaves every other run alive
- [x] The card is not rewritten by the stop — its status and body are exactly
      as the agent left them
- [x] Files the agent had already written are left on disk, unmodified
- [x] The session id is retained, and re-dispatching the card resumes that same
      session
- [x] The companion stays alive and keeps watching after a stop

## Notes

- 2026-08-05 (agent) Built in three layers, each committed green.
  - **Kill + aborted phase (companion).** `SpawnedRun.kill()` (the real spawner
    sends SIGTERM); `Runner.stop(cardId)` kills that one process and marks the
    card aborting, so its exit classifies `aborted` — checked before
    `classifyExit`, which would otherwise call a killed process an error. The
    phase is published at once (the process takes a beat to die) so the popover
    reflects the stop immediately. Aborted is terminal: run dropped, card
    untouched, session kept; the c0126 exit-reconcile then re-dispatches if the
    card was left in the trigger status.
  - **The app→companion channel.** The app has no IPC to the companion, so a
    stop travels through `.companion/control.json`, symmetric to the state file
    the other way. The **app is the sole writer, the companion the sole reader**
    — no two-writer race. Each request carries a unique id; the companion acts
    on each once and **baselines the file at startup**, so a request written
    while it was down can't kill a card that has since been re-dispatched. This
    is the one place the companion watches under `.companion/` (otherwise
    ignored). The design decision the card left open — I did not ask, as it
    followed the existing state-file/sessions-file patterns; flagging it for
    review.
  - **The two triggers (app).** The popover lists the runs, so an explicit Stop
    per live run lives there. A drag-out is destructive (it stops the run), so —
    unlike c0117's silent grace period guarding the drag *in* — `handleMove`
    confirms first when the card has a live run, and only on confirm sends the
    stop and performs the move. A card with no live run moves with no dialog.
- **Interpretation I settled**: any human move of a running card (status change)
  confirms — the agent's own moves go through MCP, never `handleMove`, so a
  `handleMove` on a running card is always an intervention. Where the card lands
  is the user's choice: dropped in a non-trigger status it stays stopped;
  dropped back in `ready` it resumes warm (the session was kept) after the
  c0117 grace period — "card position is the source of truth".
- **Criterion 10 (files left on disk) holds by construction**: the stop only
  kills the process; nothing in the abort path touches the tree, and the
  "no card write on a stop" test guards the card file specifically.
- **Verified**: unit tests across the spawner/runner (kill → aborted, others
  stay alive, session kept, no card write), the control parse/baseline, the
  app control-file builder, the popover stop, and the drag-confirm flow
  (confirm → stop+move, decline → nothing, no-run → no dialog). Plus a live
  smoke test: the bundled companion reads a control-file write and stays alive.
  1273 tests, typecheck, lint and a production build all green.

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
- 2026-07-29 status → backlog (app)
- 2026-07-30 status → ready (app)
- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 (agent) implemented in three commits: killable spawner + `aborted`
  phase; the `.companion/control.json` stop channel (app writes, companion
  reads/baselines); the popover Stop and the destructive-drag confirm. All
  twelve criteria pass; 1273 tests, typecheck, lint and a bundle build green.
- 2026-08-05 status → review (agent)
