---
id: i0119
title: Cannot start companion for different project
status: review
type: issue
ref: c0093
epic: e08
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T09:31:40
---

Trying to run pnpm companion ../popexel the companion start but does nothing when I move a card to ready

## What

Not a cross-project bug — the same thing happens on any board. The card moved
to `ready` was blocked by an unfinished dependency, and the companion said
nothing about it.

Reproduced against a copy of the popexel board: `c0058` was in `ready` with
`depends: [c0053]`, and `c0053` sits in `backlog`. `planDispatch` drops
dependency-blocked cards while building its candidate list, so the card never
reaches the WIP-budget split and never appears in `queued` either. The
companion prints its one startup line and is then silent for good. Flipping
`c0053` to `done` makes the same board dispatch `c0058`.

Refusing to run the card is right. Refusing without a word is the bug: from
the outside, "blocked by c0053" and "the companion is broken" look identical,
which is why this got filed as a startup failure.

The companion should say why a trigger-status card is not running:

- blocked by dependencies — name the ones that are not `done`
- over the WIP limit — already computed as `queued`, then discarded by the
  caller (`const { dispatch } = planDispatch(...)`)

`sync` runs on every watcher tick, so this has to report a card's reason when
it changes, not on every pass.

## Acceptance criteria

- [x] `planDispatch` reports dependency-blocked trigger cards with the ids that
      are not `done`, instead of dropping them
- [x] The companion logs the reason a ready card is not running, for both the
      blocked and the over-budget case
- [x] A reason is logged once, not on every watcher tick, and again when it
      changes
- [x] A card that becomes unblocked dispatches, and says so

## Log

- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 implemented (agent): planDispatch now partitions the trigger-status
  cards into dispatch / queued / blocked instead of filtering blocked ones out,
  and the runner logs each held-back card's reason on change (`heldBack` map,
  keyed by card id). Verified against a copy of the popexel board: the same
  startup that was silent now prints `c0058 held: waiting on c0053 (not done)`,
  both at startup and when the card is moved to ready with the watcher live.
  825 tests green, typecheck and lint clean.
- 2026-07-21 status → review (agent)
