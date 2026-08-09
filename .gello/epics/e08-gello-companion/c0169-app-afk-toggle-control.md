---
id: c0169
title: 'App: AFK toggle control'
status: ready
epic: e08
depends: [c0162]
created: 2026-08-08
updated: 2026-08-09
status-changed: 2026-08-08T23:35:54
order: 20
---

## What

The app-side switch that turns AFK on/off by writing the flag defined in
[[c0162]] ([[c0161]]). A control (e.g. in the runner popover / title bar)
reflects the current AFK state and toggles it; files-truth, so it writes the
flag (atomic write) and the companion reacts. Off by default; clearly indicated
when on.

## Acceptance criteria

- [ ] A toggle control exists in the app and reflects the current AFK state.
- [ ] Toggling writes the AFK flag ([[c0162]] contract) via an atomic write.
- [ ] The control shows AFK on vs off distinctly.
- [ ] Turning it off writes the off state; the companion returns to normal
      behaviour.
- [ ] Component-tested (toggle writes the flag; state reflects the file).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
