---
id: c0169
title: 'App: AFK toggle control'
status: review
epic: e08
depends: [c0162]
created: 2026-08-08
updated: 2026-08-09
status-changed: 2026-08-09T07:15:58
---

## What

The app-side switch that turns AFK on/off by writing the flag defined in
[[c0162]] ([[c0161]]). A control (e.g. in the runner popover / title bar)
reflects the current AFK state and toggles it; files-truth, so it writes the
flag (atomic write) and the companion reacts. Off by default; clearly indicated
when on.

## Acceptance criteria

- [x] A toggle control exists in the app and reflects the current AFK state.
- [x] Toggling writes the AFK flag ([[c0162]] contract) via an atomic write.
- [x] The control shows AFK on vs off distinctly.
- [x] Turning it off writes the off state; the companion returns to normal
      behaviour.
- [x] Component-tested (toggle writes the flag; state reflects the file).

## Notes

- **Where** — the title bar, right of the companion indicator: a muted moon
  `☾` when off, `☾ AFK` in the companion's amber when on (plus `aria-pressed`).
  It is offered whether or not a companion is running, since the companion also
  reads the flag at startup — AFK can be armed before starting one.
- **App-side flag module** — `src/lib/companion-afk.ts` mirrors
  `companion/afk.ts` (path, file content, parse) the way `companion-control.ts`
  mirrors `control.ts`; the app does not import from `companion/`. `board-io.ts`
  adds `writeAfkFlag` (through the atomic writer) and `readAfkFlag` (absent file
  → off).
- **The file is the state** — the toggle shows what `readAfkFlag` last read, not
  a UI state of its own, so a flag left on by a previous app run shows as on.
  The read rides on the existing 2s companion poll rather than a second timer.
  A click updates the control at once and puts it back if the write fails, so it
  never claims an unattended board the companion knows nothing about.
- Off is written out (`{"afk": false}`), not deleted — the AC asks for an off
  state, and the companion reads a value rather than an absence.
- `state.json`'s `afk` echo (c0162) is parsed but not shown; the flag file is
  the app's own truth. A "companion has picked it up" indication can come later
  if the lag ever reads as ambiguous.
- Unrelated flake seen while running the full suite: the two `c0154`
  auto-commit tests (fake timers) intermittently fail under parallel load. They
  fail the same way on a clean tree, so they predate this card.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 title-bar AFK toggle: `companion-afk.ts` (app mirror of the c0162
  contract), `readAfkFlag`/`writeAfkFlag` in `board-io`, the control in
  `TitleBar`, and the App wiring (poll reads the flag, click writes it).
  Documented in companion/README.md.
- 2026-08-09 status → review (agent)
