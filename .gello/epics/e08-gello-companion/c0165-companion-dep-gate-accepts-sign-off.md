---
id: c0165
title: Companion dep gate accepts sign-off
status: ready
epic: e08
depends: [c0164]
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:35:38
order: 40
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

- [ ] `planDispatch` treats a dependency in `signoff` or `done` as satisfying
      `depends`.
- [ ] A card whose only unfinished dependency is in `signoff` becomes
      dispatchable.
- [ ] A card with a dependency still in `review` / `in-progress` / earlier is
      not dispatchable (unchanged).
- [ ] The relaxation composes with the WIP and session gates, not instead of
      them.
- [ ] Unit-tested with the fake spawner (signoff dep dispatches; review dep does
      not).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
