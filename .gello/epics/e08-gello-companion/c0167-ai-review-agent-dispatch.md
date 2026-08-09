---
id: c0167
title: AI review agent dispatch
status: review
epic: e08
depends: [c0162, c0164, c0166]
created: 2026-08-08
updated: 2026-08-09
status-changed: 2026-08-09T08:15:16
usage-tokens: 46708
usage-cost: 6.533047
---

## What

Wire the review run ([[c0161]]). With AFK on, a card entering `review`
dispatches a **fresh review run** — a separate agent session with a session key
distinct from the implementer's (so it does not collide under `scope: epic`) —
using the review skill ([[c0166]]). The agent records its verdict; on pass the
card lands in `signoff` ([[c0164]]). AFK off: `review` cards sit as today. The
review run respects the WIP limit and the session gate like any run.

## Acceptance criteria

- [x] AFK on: a card entering `review` dispatches a review run using the review
      skill.
- [x] The review run uses a session key distinct from the implementer's (no
      collision under `scope: epic`).
- [x] AFK off: `review` cards are not auto-reviewed (unchanged).
- [x] On pass the card ends in `signoff`; the verdict is recorded on the card.
- [x] The review run respects the WIP limit and the session gate.
- [x] Unit-tested with the fake spawner (review dispatch; pass → signoff;
      session-key distinctness; AFK-off no-op).

## Notes

- **Dispatch** — `planReviewDispatch` in `companion/runner.ts`, planned and
  started inside `sync` before the `ready` cards, so on a board with one slot a
  review goes first: finishing a card unblocks its dependents ([[c0165]]),
  starting one only adds to the pile. Nothing in `main.ts` changed — the
  watcher and the AFK toggle already call `sync`, so toggling AFK on also picks
  up `review` cards already sitting there (the retroactive question in
  [[c0161]]).
- **Session key** — `sessionKey(card, scope, "review")` → `review:card:<id>`,
  per card under either scope. Under `scope: epic` the implementer's key is the
  epic's, so sharing it would collide with the epic's next card and hand the
  reviewer the context it is there to check from the outside. An active review
  run therefore holds a key no implementer candidate can match, which
  `planDispatch` needs told (`reviewing`) — otherwise a card being reviewed
  would stall its whole epic.
- **One review per stay in `review`.** Two guards, because either alone leaks:
  a verdict stamped after the card's `status-changed` is this round's (durable,
  survives a restart, and is what stops a fail from being re-reviewed every
  sync); an in-process set of dispatched cards, cleared when the card leaves
  `review`, covers a run that died before writing anything. Unreadable stamps
  count as reviewed — the [[c0162]] safe default.
- **Pass → `signoff` is the agent's move**, via `set_status` per the skill; the
  companion never edits cards. On exit the runner logs what the card ended up
  saying (`c0167 review verdict: pass (signoff)`), so a run that recorded
  nothing is visible rather than passing for a clean review.
- The `set_status` tool description ordered *every* run to move its card to
  `in-progress` "the moment you start" — with a reviewer on the same tool that
  is an instruction to take the card it is checking. It now describes the move
  and leaves the timing to the run's prompt.
- A review run is not added to `owned`: that set gates restarting a stopped
  implementer run ([[c0141]]/[[i0135]]), and having reviewed a card says
  nothing about having worked it. Its tokens do go on the card's usage totals —
  a card's cost includes what reviewing it cost.
- No pickup grace period on a review: that window is the human's chance to
  catch a card before an agent takes it, and it was already spent on the way
  into `ready`. A card whose implementer run has not exited yet is skipped
  (`!active`), so a review never starts on a half-written commit.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 review dispatch in `companion/runner.ts` (`needsReview`,
  `planReviewDispatch`, review runs in `sync`), review session key in
  `sessions.ts`, neutral `set_status` description; documented in
  companion/README.md; 22 tests
- 2026-08-09 status → review (agent)
