---
id: c0097
title: Dispatch flow — ready → run → write-back
status: ready
epic: e08
depends: [c0093, c0094, c0095, c0096]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T15:07:29
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

- [ ] A card entering `ready` dispatches a run; the card is moved to
      `in-progress` (WIP limits respected — over-limit cards queue, not run)
- [ ] The run resumes or starts a session and passes the card as the task;
      the agent performs the board mutations (companion does not edit cards)
- [ ] A parked question pauses the run; the auto-resume (c0096) continues it
- [ ] The state file reflects each run's phase (running / waiting-for-input /
      done / error)
- [ ] A crashed/failed agent leaves the card recoverable and surfaces the
      error in the state file (non-fatal to the companion)

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)
