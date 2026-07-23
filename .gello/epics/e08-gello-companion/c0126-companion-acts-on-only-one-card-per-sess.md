---
id: c0126
title: Companion acts on only one card per session id
status: in-progress
created: 2026-07-22
updated: 2026-07-23
status-changed: 2026-07-23T07:06:12
epic: e08
---

## What

An agent session is single-threaded: one agent, one conversation. So the
companion must never dispatch two cards that resolve to the **same session id**
at once. Under the default epic scope, `sessionKey` maps every card in an epic
to `epic:<id>`, so this means **only one card per epic runs at a time** —
the rest of that epic queues behind it. Cards in *different* epics still run in
parallel up to the WIP limit, and a standalone card (no epic) keeps its own
`card:<id>` session, so those parallelise too.

**This also fixes a latent bug.** Today `planDispatch` gates only on the WIP
limit and per-*card* activity — nothing checks the session id. So two ready
cards in the same epic, under WIP 2, both dispatch; the second then
`--resume`s a session the first is already using and fails with "already in
use". The gate this card adds is what stops that.

**Serialization is the right behaviour, not just a workaround.** Cards in one
epic build on each other and touch the same files; running two at once in one
shared conversation would corrupt that conversation's context and race on the
tree. Wanting genuine intra-epic parallelism is a different choice — it means
`scope: card` (a fresh session per card), which this rule leaves untouched.

**A parked card holds its session.** A `waiting-for-input` run keeps its slot
and its session until you answer and it finishes; other same-epic cards wait,
even if the question sits unanswered for a while. That is honest to the
one-session reality — you cannot run another card in that session without
polluting the parked card's context — and freeing the slot is only meaningful
under `scope: card`.

**Mechanism.** The runner already tracks `active` runs; each active card
resolves to a session key via `sessionKey`. A candidate is dispatchable only
when its session key is not held by any active run — an additional gate
alongside WIP and the `depends` check, composed the same way. A card held for
this reason joins the existing held-back reporting (the i0119 terminal line),
so a serialised epic does not look stalled.

## Acceptance criteria

- [ ] A card is not dispatched while another active run holds the same session
      id (per `sessionKey` under the current scope)
- [ ] Under `scope: epic`, two ready cards in one epic run one at a time; the
      second dispatches only after the first ends (done, error, or aborted)
- [ ] Cards in different epics still run concurrently up to the WIP limit
- [ ] A standalone card (no epic) is never blocked by an epic card's session,
      and vice versa
- [ ] Under `scope: card`, no card is ever blocked by another's session
- [ ] A `waiting-for-input` (parked) card keeps its session held — same-epic
      cards do not start until it resumes and finishes
- [ ] Resuming the parked card itself is not blocked by its own held session
- [ ] The session gate composes with the WIP limit and the `depends` gate, not
      instead of them
- [ ] A card held only because its session is busy is reported (i0119-style),
      naming the card currently holding it
- [ ] It is unit-tested with the fake spawner: two same-epic cards serialise,
      two cross-epic cards do not

## Discussion

- **Enforce, not remove** (human's call): serialising an epic matches how its
  cards actually relate (shared context, shared files) and removes the session
  collision. Intra-epic parallelism, when wanted, is `scope: card` — a separate
  configuration, not a change to this rule.
- **Parked holds the session** (human's call): under one shared session there
  is nowhere else for a same-epic card to run, so a parked card blocks its epic
  until resolved. Rejected: letting a parked card free the slot, which is only
  coherent under `scope: card`.
- **Per session id, not per epic**: framing the gate on the session key (not on
  the epic directly) is what makes it correct across scopes for free — card
  scope yields unique keys and therefore no serialisation, epic scope yields
  shared keys and therefore serialisation, with one rule.
- **Report the hold**: without it a serialised epic looks like the popexel
  dependency case — a card sitting idle with no visible reason. It reuses the
  i0119 held-back line rather than adding UI.
- **Open**: whether the app should also *show* the session hold on the card
  front (the c0123 line already carries "blocked"; a companion-specific hold
  would need the reason published into the state file — the same gap noted
  for the WIP-limit hold); whether a very long parked card should eventually
  warn that it is blocking its epic.

## Log

- 2026-07-23 status → discuss (app)
- 2026-07-23 discussed (human): enforce one active run per session id — under
  epic scope one card per epic at a time, cross-epic still parallel; a parked
  card holds its session; the gate composes with WIP and `depends` and reports
  the hold. Also closes the same-epic dispatch collision.
- 2026-07-23 status → ready (app)
- 2026-07-23 status → in-progress (agent)
