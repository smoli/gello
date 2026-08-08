---
id: c0161
title: AFK-Mode
status: backlog
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:29:01
epic: e08
depends: [c0162, c0163, c0164, c0165, c0166, c0167, c0168, c0169, c0170]
---

> **Umbrella card.** This is the AFK-mode spec, not a unit of work — the
> implementation is the child cards [[c0162]]–[[c0170]] (see the epic's *AFK
> mode plan*). It `depends` on all of them, so it stays blocked until the
> feature is complete; do not pick it up directly. Move the roots ([[c0162]],
> [[c0164]], [[c0166]]) to `ready` to start.

## What

Frontload the `ready` queue and let the companion work through it while the
user is away. Two things stop that autonomous drain today, and AFK mode (an
explicit toggle) removes both.

**Part 1 — open questions.** An agent that parks a question (`## Open
question`, `awaiting: input`) keeps its WIP slot and its session
([[c0126]]), so the queue stalls on the first card that needs a decision. In
AFK a parked run **frees its WIP slot but keeps its session hold**: dispatch
picks the next non-session-held card and drains around it. Under `scope: epic`
the parked card's epic waits behind it (shared session); other epics and
standalone cards proceed. Under `scope: card` only the parked card waits. The
agent still parks exactly as now — AFK changes only the slot accounting.

**Part 2 — the review gate.** Dependents gate on `depends` being `done`, and
only a human moves a card to `done`. So overnight a card reaches `review` and
never `done`, stalling both the review pile and every card that depends on it.
In AFK a card entering `review` dispatches a **fresh review agent** (separate
session, its own review skill) that checks the acceptance criteria, test
results, lint/typecheck, and the diff:

- **Pass** → move the card to a new **sign-off column between `review` and
  `done`** (AI-reviewed cards awaiting the human). This frees the `review`
  column and gives the human one clear list to check; the AI review is
  documented in the card. The card is not `done` (only a human moves it there),
  but the **companion's dependency gate treats the sign-off column as satisfying
  `depends`** — a lower gate than the human's `done` — so dependents flow.
- **Fail** → move the card back to `in-progress` and resume the original
  implementer session with the review notes; it fixes and re-enters review.
  Capped at ~2 rounds; on exhaustion, park a question for the human (Part 1's
  skip-ahead behaviour).

Enablement is an app toggle: the app writes an AFK flag into a `.gello/` file,
the companion watches it, no restart. Turning AFK off is the same toggle.
Non-AFK behaviour is unchanged — review cards sit, parked runs hold their
slots.

## Acceptance criteria

- [ ] AFK is off by default and toggled from the app, which writes a flag into
      a `.gello/` file the companion watches; the companion applies the change
      without a restart.
- [ ] AFK off: behaviour is unchanged — a parked run holds its WIP slot and
      session, and a `review` card is not auto-reviewed.
- [ ] AFK on: a parked (`waiting-for-input`) run releases its WIP slot but
      still holds its session key; `planDispatch` dispatches the next
      non-session-held card into the freed slot.
- [ ] AFK on, `scope: epic`: a parked card's epic waits behind it while other
      epics and standalone cards proceed; `scope: card`: only the parked card
      waits.
- [ ] AFK on: a card entering `review` dispatches a review run in a fresh
      session (session key distinct from the implementer's) using the review
      skill.
- [ ] The review agent checks acceptance criteria, test results,
      lint/typecheck, and the diff, and records a pass/fail verdict on the card.
- [ ] A new sign-off status/column is added between `review` and `done` (in
      `board.yaml` statuses + column order); on pass the card moves there and
      the `review` column frees.
- [ ] The AI review is documented in the card (verdict + what was checked).
- [ ] The companion's dependency gate treats the sign-off column (and `done`)
      as satisfying `depends`; a dependent whose dependency is in sign-off
      dispatches. Only a human moves sign-off → `done`.
- [ ] On fail the card returns to `in-progress` and the original implementer
      session resumes with the review notes; it re-enters review on completion.
- [ ] The auto-review↔fix loop is capped (~2 rounds); on exhaustion the card
      parks a question and the queue skips ahead.
- [ ] The review run respects the WIP limit and the session gate like any run.
- [ ] Dispatch skip-ahead, review pass/fail, the fix-loop cap, and AFK on/off
      gating are unit-tested with the fake spawner.

## Discussion

Decisions:

- **AFK is an explicit app toggle, files-truth** (chosen): a `.gello/` flag
  written by the app, watched by the companion. Rejected: a companion CLI/env
  flag (needs a restart) and a persistent `board.yaml` setting (not a momentary
  "I'm leaving" switch). Note: the published state file is companion→app, but
  the toggle is app→companion, so it needs a separate app-written file/field.
- **Parked question → free the WIP slot, keep the session hold** (chosen): AFK
  flips exactly the one calculation [[c0126]] made on purpose (a parked run
  holds its slot). Keeping the session hold makes skip-ahead correct across
  scopes for free. Rejected: freeing the session too (revives the same-session
  collision c0126 closed).
- **Get past review with a fresh AI review agent, not by relaxing deps**
  (chosen): dependents build on vetted work, so a late human rejection does not
  cascade rework through a chain built on a bad base. Rejected: counting
  `review` as satisfying `depends` (dependents build on un-vetted work).
- **Review runs in a fresh, separate session** (chosen): independent of the
  implementer's context and bias. Needs a distinct session key so it does not
  collide with the epic session under `scope: epic`.
- **Pass → a new sign-off column between `review` and `done`** (chosen, refined
  from an earlier done-plus-marker idea): AI-reviewed cards get their own column,
  which frees `review` and gives the human one clear check-list. `done` stays
  strictly human; the companion's dependency gate is satisfied by the sign-off
  column — a lower gate than `done` — so dependents flow. AI review is
  documented in the card either way. Rejected: `done` + an AI-reviewed marker
  (muddies `done`, no dedicated list, needs an exception to "only a human moves
  to `done`"); relaxing deps to accept raw `review` (dependents build on
  un-vetted work).
- **Fail → fix loop, capped, then park** (chosen): resume the implementer with
  the notes so most work finishes autonomously; cap (~2) bounds review↔fix
  cycling; on exhaustion, park for the human. Rejected: park immediately (less
  finishes); back-to-`ready` fresh redo (loses implementer context, repeats the
  mistake).

Open questions:

- Name of the new sign-off status/column (`signoff`? `to-check`? `approve`?)
  and the AFK flag field.
- The review skill's exact checklist and how the verdict is recorded (a
  `## Review` section vs. frontmatter).
- Retry-cap value (2?) and whether it is configurable.
- Is the sign-off column an AFK-only concept or a general board status, and is
  the companion's "sign-off satisfies deps" gate AFK-only or always on?
- Retroactive vs. forward-only: on toggle-on, does the companion also review
  `review` cards already sitting? (Likely yes — reconcile and dispatch review
  runs for them.)
- Whether the auto-review capability is useful outside AFK (a manual "AI-review
  this card" action) — out of scope here.

This is a sizeable feature (a toggle contract, a dispatch change, a review
agent + skill, a new sign-off status + column, app UI). It likely wants
breaking into child cards via the plan skill before implementation.

## Log

- 2026-08-08 status → discuss (app)
- 2026-08-08 discussed (human): AFK = explicit app toggle (files-truth), off by
  default. Part 1 — a parked question frees its WIP slot but keeps its session
  hold, queue skips ahead. Part 2 — a fresh AI review agent reviews `review`
  cards: pass → `done` marked AI-reviewed/awaiting-sign-off (unblocks deps,
  which stay gated on `done`), fail → fix loop (resume implementer, ~2 rounds)
  then park. Refined What, drafted acceptance criteria.
- 2026-08-08 refined (human): pass no longer moves to `done` + marker; instead a
  new **sign-off column between `review` and `done`** holds AI-reviewed cards.
  Frees `review`, gives the human a clear check-list, keeps `done` human-only;
  the companion's dep gate is satisfied by the sign-off column (a lower gate
  than `done`). AI review documented in the card.
- 2026-08-08 status → backlog; to be broken into child cards via /gello-plan.
