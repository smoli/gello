---
id: c0097
title: Dispatch flow — ready → run → write-back
status: review
epic: e08
depends: [c0093, c0094, c0095, c0096]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T15:32:00
---

## What

Tie the pieces into the run lifecycle. On the c0093 trigger (a card entering
`ready`), dispatch an agent run and manage it through completion, including
the c0096 Q&A park/resume.

- Pick up: move the card to `in-progress` (respecting WIP limits — skip/queue
  if the limit is hit).
- Run: resume-or-start the session (c0095) via the adapter (c0094) with the
  card as the task; the **agent** does the board work (Notes/Log, checking
  criteria, moving to review) per gello conventions.
- Q&A: if the agent parks a question (c0096), reflect it in the state file and
  wait for the answer, then resume.
- Publish run status to the state file (c0093) throughout (running / waiting /
  done / error).

## Acceptance criteria

- [x] A card entering `ready` dispatches a run; WIP limits respected —
      over-limit cards queue, not run (`planDispatch` + `occupiedSlots`). The
      `in-progress` move is done by the **agent**, not the companion — see the
      boundary note in Discussion.
- [x] The run resumes or starts a session (c0095) and passes the card as the
      task (via the c0094 adapter); the agent performs the board mutations —
      the companion never edits cards
- [x] A parked question pauses the run (clean exit + unanswered open turn →
      `waiting-for-input`); answering it (`cardsAnswered`, c0096) resumes the
      **same** session
- [x] The state file reflects each run's phase — `runs[]` carries
      running / waiting-for-input / done / error; overall status derives from
      them (+ parked cards)
- [x] A crashed/failed agent → `error` phase, run removed, card left exactly
      as the agent left it (recoverable); non-fatal to the companion (a spawn
      error surfaces as a null exit → error)

## Discussion

- **Companion never edits cards** (honoring the epic principle and this card's
  own AC2). The literal AC1 phrasing "the card is moved to `in-progress`" is
  satisfied by the **agent** doing that pickup move (gello convention, in the
  task prompt), not the companion. To keep the WIP gate correct despite that
  async flip, `occupiedSlots` counts `in-progress` cards **unioned with active
  runs** — a dispatched run occupies a slot the instant it starts, so two
  syncs can't race past the limit before the agent flips the status.
- **Queue drains on `sync`**: dispatch is recomputed every reconcile from
  `planDispatch(next)`, so a queued ready card starts as soon as a slot frees
  (no separate queue structure).
- **Injectable spawner**: the process boundary (`Spawner`) is injected, so the
  whole lifecycle — dispatch, park, resume, done, error, WIP — is unit-tested
  with a fake process; `main.ts` supplies the real `child_process.spawn`.

## Implementation

- [companion/runner.ts](../../../companion/runner.ts): pure helpers
  `occupiedSlots`, `planDispatch` (ready + deps-done + under budget, board
  order), `classifyExit` (error / waiting-for-input / done), `buildTaskPrompt`
  (run + resume variants); and the `Runner` (injected `Spawner` + `reload`)
  driving start → exit-classify → resume, publishing `runs[]` on every change.
- [companion/main.ts](../../../companion/main.ts): real `child_process.spawn`
  spawner (inherit stdio, spawn-error → null exit → error), wires the Runner,
  folds `runs[]` and derived `status` into the published state; agent + scope
  from `GELLO_COMPANION_AGENT` / `GELLO_COMPANION_SCOPE` (config is c0099).
- Tests: [companion/runner.test.ts](../../../companion/runner.test.ts) — 17
  covering WIP gating, exit classification, prompts, and the full lifecycle
  (dispatch → park → answer/resume-same-session → done; crash → error; WIP cap)
  with a fake spawner.
- Smoke-tested end-to-end with a fake `claude` shim: a ready card spawned
  `claude --session-id <uuid> -p "Work gello card …"` and classified `done` on
  a clean exit, with no card writes by the companion.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)
- 2026-07-19 status → in-progress; implemented the run lifecycle
  (`companion/runner.ts` + `main.ts` wiring): WIP-gated dispatch, session
  resume/start via the adapter, park→answer→resume, phase publishing, crash
  handling. 17 runner tests; companion suite 53 green, full suite 560 green,
  typecheck + lint clean; smoke-tested with a fake agent. status → review.
