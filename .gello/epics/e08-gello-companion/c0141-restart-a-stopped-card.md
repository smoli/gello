---
id: c0141
title: restart a stopped card
status: in-progress
created: 2026-07-28
updated: 2026-08-05
status-changed: 2026-08-05T13:03:07
epic: e08
---

## What

When a companion run stops abnormally — quota exceeded, connection lost, a
crash — the agent process dies with a non-zero exit. Today the card is left in
`in-progress`, the run is dropped from the state file, and **nothing re-picks
it up**: dispatch only triggers on `ready`. The work stalls silently. Add a
**manual restart** that re-runs such a card, **resuming its session** so it
continues warm rather than starting over.

- **Detect a stopped card:** `in-progress`, the companion is live, it is a card
  the companion **owns a session for**, and it has **no live run** in the state
  file. (A parked card is a live `waiting-for-input` run, so it is *not*
  stopped.)
- **Restart in place** (human's call): re-dispatch while the card stays
  `in-progress` — resume its session (c0095), spawn the agent, mark it running.
  No status churn, no grace-period round-trip.
- **Only companion-owned cards** get the affordance: a card a human moved to
  `in-progress` and is editing has no companion session and must never have an
  agent spawned on it.

**Two things this needs that do not exist yet:**

1. **The companion publishes the card ids it owns a session for** into
   `state.json`, so the app can tell a restartable stopped card from a human's
   in-progress card.
2. **An app→companion control channel.** "In place" restart cannot use the
   board as the signal (that was the rejected move-to-ready path), so the app
   must *command* the companion: write a restart request into `.companion/`,
   which the companion watches, executes once, and clears. This is the **first
   time the app commands the companion** — today it only reads `state.json`.
   **c0119 (stop an in-flight run) needs the same channel**; they should share
   one command path, not invent two.

**Composition.** Restart re-dispatches only when the card's session is free (the
c0126 gate) and the companion is live; a stopped card whose whole companion is
down waits for it to be started first (c0110). The re-run occupies the slot the
in-progress card already holds, so WIP is unaffected.

## Acceptance criteria

- [x] A stopped card is identified as `in-progress` + companion live +
      companion-owned session + absent from the state file's live `runs`
- [x] The companion publishes the set of card ids it owns a session for in
      `state.json`
- [x] A restart action is offered only on a stopped card — never on a
      parked/running card, nor a human-worked in-progress card with no session
- [x] Restart re-dispatches in place: the card stays `in-progress` (no move to
      `ready`)
- [x] The re-dispatch resumes the card's existing session (warm), not a fresh
      one
- [x] Restart travels an app→companion control channel — a request the app
      writes and the companion consumes once and clears
- [x] Restart respects the c0126 session gate — it does not start while that
      session is busy
- [x] Restart is unavailable when no companion is live
- [x] Restart is manual only — nothing auto-retries a stopped card
- [x] The channel handling (parse a request, act once, clear; ignore malformed
      or duplicate requests) is unit-tested

## Notes

- 2026-08-05 (agent) **The shared channel already existed.** c0119 shipped the
  app→companion control file (`.companion/control.json`, app sole-writer,
  companion baselines + acts-once). This card generalised it to carry a `kind`
  (`stop` | `restart`) instead of inventing a second path — a missing kind
  defaults to `stop`, so c0119's own entries still parse. `main.ts` dispatches
  each new request by kind.
- **Ownership, published.** The runner tracks the card ids it owns a session
  for: every card it runs, plus those recovered from a persisted `card:<id>`
  session at startup. An epic session (`epic:<eid>`) names no single card, so
  epic-scope ownership is tracked live only — a limitation noted below. It
  publishes `owned` in `state.json`; the app's `isStoppedCard` matches it
  against an in-progress card with no live run to decide the affordance. This is
  the safety line: a human-worked in-progress card has no session → never owned
  → never a restart.
- **Restart in place.** `Runner.restart(cardId)` resumes the session with the
  card left where it is — guarded to owned + in-progress + no active run + a
  free session (the c0126 gate); anything else is a logged no-op. It reuses
  `start()`, which resumes when a session exists (`--resume`, warm).
- **Interpretations settled**: (1) "consumed once and clears" (criterion 6) is
  met by the seen-id set + startup baseline c0119 established, not by physically
  truncating the file — the effect ("acts exactly once, never re-fires") is the
  same, and it keeps the app the sole writer. (2) The affordance lives on the
  **card front** (the card's "Open" listed front/popover/TUI): the runs popover
  only lists *live* runs, and a stopped card has none, so the front is the only
  surface that can show it.
- **Known limitation** (surfaced, not hidden): under `scope: epic`, a card
  stopped and then left across a *companion restart* is not re-owned (the epic
  session can't be traced back to a specific card), so it shows no restart until
  the companion runs it again. Under the default `scope: card` and the common
  same-process case (a run dies while the companion stays up), ownership is
  fully recovered.
- **Verified**: unit tests for `restart` (warm resume, refuses unowned /
  not-in-progress / already-active / session-busy), the control parse + kind
  default + baseline/act-once, `isStoppedCard`, the app control writer, and the
  card-front affordance (offered only when owned + live + no run). Plus a live
  smoke test: the bundled companion publishes `owned` and refuses a restart for
  an unowned card with a clear log line, staying alive. 1339 tests, typecheck,
  lint and a bundle build all green.

## Discussion

- **Manual only** (human's call): auto-retry risks looping on a persistent
  failure or hammering an exhausted quota; the human knows when conditions are
  back. Rejected: bounded auto-retry — a follow-up once we know which failures
  are transient in practice.
- **Re-dispatch in place** (human's call): no status churn and no grace-period
  round-trip, at the cost of a new in-progress dispatch path *and* the
  control channel below. Rejected: move-to-ready — nearly free and reuses the
  whole pipeline, but churns the status and re-applies the c0117 delay.
- **Only companion-owned cards** (human's call): the safety line — never spawn
  an agent on a card a human is hand-editing. Needs the companion to publish
  its owned sessions, matched against stopped in-progress cards.
- **Shared control channel with [[c0119]]**: an explicit *stop* (c0119) and an
  explicit *restart* (here) are both app→companion commands. They should share
  one channel; this card and c0119 co-design it, or this one depends on it.
- **Warm resume is the point**: the session persisted through the failure, so
  restarting continues the partial work rather than paying the cold start
  again.
- **Open**: where the restart affordance lives (the c0100 runs popover, the
  card front, the TUI c0112); how a resume that fails again is surfaced (it
  re-errors and stays restartable); whether the channel is a request file the
  companion polls or one it watches.

## Log

- 2026-07-28 status → discuss (app)
- 2026-07-28 discussed (human): manual restart of a stopped in-progress card,
  re-dispatched in place resuming its session; offered only for companion-owned
  cards (companion publishes owned sessions); needs a new app→companion control
  channel shared with c0119's stop.
- 2026-07-29 status → backlog (app)
- 2026-07-29 status → ready (app)
- 2026-08-05 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 (agent) implemented: `Runner.restart` (warm, in-place, gated),
  `owned` published in state.json, the c0119 control channel generalised to a
  `kind`, `isStoppedCard`, and a card-front Restart affordance. All ten criteria
  pass; 1339 tests, typecheck, lint and a bundle build green. Noted an
  epic-scope-after-companion-restart ownership limitation.
