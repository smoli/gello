---
id: i0124
title: 2 of 1 in progress
status: done
type: issue
created: 2026-08-03
updated: 2026-08-05
status-changed: 2026-08-05T12:05:52
---

Asked claude to create a new card while the companion was already having one in progress.

Claude created the card in ready, and the companion picked it up immediately, it think even without waiting the set delay. Now there's two cards running although the board is set to have only one in progress:

![image](../assets/i0124/image.png)

## Acceptance criteria

- [x] The companion enforces the WIP limit board.yaml configures *now*, not the
      one it read at startup — a limit tightened mid-session holds.
- [x] A loosened limit takes effect without restarting the companion.
- [x] No `wip_limits` in board.yaml still means unlimited.
- [x] The held-back line names the limit actually in force.
- [x] A card written straight into `ready` with no `status-changed` serves the
      pickup grace period instead of dispatching at once.
- [x] That card is never stuck: it dispatches once the window elapses, and its
      countdown restarts if it leaves the column and comes back.
- [x] A real `status-changed` still wins over the first-seen fallback.

## Notes

Two separate defects, one per symptom.

**The WIP limit was a startup snapshot.** `main.ts` read
`model.config.wipLimits["in-progress"]` once when constructing the `Runner` and
passed it as `RunnerOptions.wipLimit`; every later `sync` planned against that
value while the board was reloaded on each watcher tick. Editing board.yaml
(or a board.yaml that failed to parse at startup, which yields `Infinity`) left
the runner enforcing a limit nobody could see — the TUI header already read the
live model, so it showed the new limit while dispatch used the old one. Fixed by
dropping the option and reading `wipLimitOf(model)` inside `sync`, so the board
being synced is the only source.

**The grace period skipped agent-created cards.** `pickupWait` timed the window
from `status-changed`. An agent writing a new card straight into `ready` writes
no such stamp — the card never changed status — so `Date.parse` failed and c0117
treated it as eligible immediately. That is exactly the reported case. The stamp
is still preferred; when it is missing or unparseable, the clock is now when the
companion first saw the card in the trigger status (`Runner.firstSeen`, cleared
when a card leaves the column, so the countdown restarts the way a real stamp
would). c0117's "never blocked forever" holds — the card dispatches one window
after it was first seen.

Left alone deliberately:

- **Resumes still bypass the budget** (c0117's call). A parked run already holds
  its slot; refusing to resume an answered question would strand it.
- **The card front shows no countdown for an unstamped card.** `firstSeen` is
  in-memory in the companion and not on the board, so `pickupCountdown` has
  nothing to render. The card waits its window silently. Publishing an effective
  deadline per ready card in `state.json` would close that — its own card if the
  silence bothers.

Unrelated pre-existing red on `main` at the time of this fix: 12 failures in
`Board.test.tsx` / `App.test.tsx` (c0118 follow-up trigger), `board.test.ts` and
`demo/holzhof-board.test.ts`. Present with this change stashed, untouched here.

## Log

- 2026-08-03 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 fixed both halves: live WIP limit from the board being synced, and
  a first-seen pickup clock for cards with no `status-changed`. 7 new companion
  tests; 91 in `runner.test.ts`, 298 across `companion/` green.
- 2026-08-05 status → review (agent)
- 2026-08-05 status → done (app)
