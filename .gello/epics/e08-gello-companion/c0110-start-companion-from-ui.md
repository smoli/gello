---
id: c0110
title: Start companion from UI
status: in-progress
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T23:16:50
epic: e08
---

## What

Start the companion for the open board from the app, instead of switching to a
shell and typing the command. The app **opens the OS terminal running the
companion** — it does not manage the process. The terminal is where the c0104
verbose stream shows, and Ctrl-C is how you stop it; the app just detects the
running companion through its state file (c0100).

- **Affordance** — when no companion is running for the open board (no
  `.companion/state.json`, or it is stale), the title-bar runner area offers a
  **Start companion** action. Once it is running, that spot is the c0100
  indicator. So the same corner is "start" or "status", never both.
- **Launch** — a thin Rust command opens the platform terminal with
  `gello-companion <project-dir>` for the currently open project. This mirrors
  the existing `std::process::Command` use in `git.rs`; it is a process spawn,
  not business logic, so it stays a thin Rust seam.
- **The app owns nothing after launch** — the terminal owns the process.
  Closing the app leaves the companion running; the app never kills it. This
  keeps the companion's headless independence (c0069) intact.

**Scope: dev checkout only.** The companion is a `.ts` run via `tsx`, so the
launch assumes `gello-companion` is on `PATH` (the README's
`pnpm link --global`). Launching from a *distributed* app — no node, no
companion source — needs a bundled companion binary and is its own card.

## Acceptance criteria

- [x] With a board open and no running companion (no state file, or it is
      stale), a "Start companion" action is shown in the title-bar runner area
- [x] While a companion is running, the action is replaced by the c0100
      indicator (never both at once)
- [x] Clicking it opens the OS terminal running `gello-companion <project-dir>`
      for the open board's project root
- [x] The launch command construction (command + project-dir argument) is a
      pure, unit-tested function
- [ ] On the dev platform (macOS), launching starts the companion — its state
      file appears and the indicator turns on within a poll cycle
      *(needs a live click in the app — left for the human; see Notes)*
- [x] If the terminal or command cannot be launched, the failure is surfaced to
      the user, not swallowed
- [x] The app does not track or terminate the companion process (the terminal
      owns its lifetime)

## Discussion

- **Open a terminal, not a managed process** (human's call): the terminal is a
  free log view (the c0104 stream), a familiar stop (Ctrl-C), and it needs no
  in-app output surface or lifecycle handling. Rejected: spawning a managed
  background child with a start/stop toggle — nicer one-click UX, but it needs
  an in-app place for the stream and a kill-on-close decision; revisit once
  c0109's activity surface exists.
- **Dev checkout only** (human's call): assume `gello-companion` on `PATH`.
  Distributed launching (bundled binary) is deferred to its own card. Rejected:
  detect-and-degrade now.
- **Start lives on the runner indicator**: the c0100 corner already means
  "companion" — absent → offer start, present → show status. One place, no new
  chrome.
- **The terminal owns the process**: the app spawning-and-managing it would
  couple the companion's lifetime to the app and undercut headless mode (c0069).
- **Open**: the exact per-OS terminal invocation (macOS `osascript`/`open -a
  Terminal`; Windows `wt`/`cmd`; Linux `x-terminal-emulator`) — macOS first,
  the others best-effort or a follow-up; whether the command is also
  configurable (companion.yaml) rather than hard-coded to `gello-companion`;
  whether to also expose Start in the ProjectMenu.

## Log

- 2026-07-20 status → discuss (app)
- 2026-07-20 discussed (human): the app opens the OS terminal running
  `gello-companion <project-dir>` (not a managed process); Start lives on the
  c0100 runner-indicator corner when nothing is running; the terminal owns the
  process lifetime; scope is the dev checkout (`gello-companion` on PATH),
  distributed launching deferred.
- 2026-07-20 status → backlog (app)
- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
