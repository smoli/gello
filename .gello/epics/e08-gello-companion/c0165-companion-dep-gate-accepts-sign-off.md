---
id: c0165
title: Companion dep gate accepts sign-off
status: done
epic: e08
depends: [c0164]
created: 2026-08-08
updated: 2026-08-26
status-changed: 2026-08-26T19:45:01
usage-tokens: 12582
usage-cost: 1.831976
---

## What

For dependents to flow overnight, the companion's dependency gate must treat
`signoff` as satisfying `depends`, not only `done` ([[c0161]]). `planDispatch`
currently gates a card as dispatchable when its `depends` are all `done`;
extend that so a dependency in `signoff` (or `done`) counts as satisfied. This
is a lower gate than the human's `done` — the human's notion of finished stays
`done`.

Open (from the epic): whether this applies only in AFK or always. Default to
applying whenever the companion dispatches, since `signoff` means AI-vetted;
revisit if it should be AFK-gated.

## Acceptance criteria

- [x] `planDispatch` treats a dependency in `signoff` or `done` as satisfying
      `depends`.
- [x] A card whose only unfinished dependency is in `signoff` becomes
      dispatchable.
- [x] A card with a dependency still in `review` / `in-progress` / earlier is
      not dispatchable (unchanged).
- [x] The relaxation composes with the WIP and session gates, not instead of
      them.
- [x] Unit-tested with the fake spawner (signoff dep dispatches; review dep does
      not).

## Notes

- The gate is `missingDepends` in `companion/runner.ts`: a dependency satisfies
  `depends` when its status is in `{done, signoff}`. Applied on every dispatch,
  not only under AFK — the epic's default, since `signoff` is AI-vetted either
  way.
- The held-back line now reads `waiting on c009 (not signed off)` instead of
  `(not done)`, so the reported reason matches the gate.
- Out of scope: the app's own blocked indicator (`blockedBy` in
  `src/lib/board.ts`, `CardStatusLine`) still counts only `done` as finished.
  That is the human's view of a dependency, which the card keeps at `done`.
  Worth a follow-up if the two views should agree.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 dep gate accepts `signoff`; 6 tests added in `runner.test.ts`
- 2026-08-09 status → review (agent)
- 2026-08-09 status → done (app)
- 2026-08-09 status → review (app)
- 2026-08-26 status → done (app)
