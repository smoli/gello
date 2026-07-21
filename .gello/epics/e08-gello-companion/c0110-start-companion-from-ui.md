---
id: c0110
title: Start companion from UI
status: done
created: 2026-07-20
updated: 2026-07-21
status-changed: 2026-07-21T12:22:52
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

## Notes

- 2026-07-20 (agent) Implemented in three commits.
  - **Rust seam** (`src-tauri/src/companion.rs`): pure `terminal_command(dir)`
    builds the macOS `osascript` "do script" that runs `gello-companion <dir>`
    in Terminal.app (POSIX single-quoting the dir, escaping for the AppleScript
    literal); `start()` spawns it and returns an error string on failure. A
    thin `start_companion` Tauri command wires it. Opening a **login-shell
    terminal** (not spawning the process directly) is also what gives
    `gello-companion` the user's `PATH`. Non-macOS returns an error (dev-checkout
    scope). Unit-tested via `cargo test` (quoting/escaping edge cases).
  - **Liveness** (`companion.ts`): `isCompanionLive(state, now)` = state file
    present and not stale (shared ~30s threshold, now the single `STALE_MS` that
    `activity.ts` also imports). Unparseable `updated` counts as live — only a
    corrupt file hits that, and hiding a running companion behind Start is worse.
  - **UI** (`TitleBar`): the runner corner is Start when not live, the c0100
    indicator when live — never both. App's `handleStartCompanion` invokes the
    command and surfaces a failure via the error banner; it keeps no handle.
- **Criterion 5 left for the human**: the live end-to-end click isn't
  auto-triggered — a started companion begins **dispatching agent runs** on any
  `ready` cards, so firing it unattended from here would kick off real work. All
  its pieces are tested (command construction, spawn wiring, poll→indicator);
  clicking Start in the running app is the last manual confirmation.
- **Open questions**: only macOS is wired (the card's "macOS first"); the
  command is hard-coded to `gello-companion` (companion.yaml override not done);
  Start is only on the title-bar corner (not the ProjectMenu). All three are
  the deferred paths the card names, not gaps.

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
- 2026-07-20 (agent) Implemented: Rust `companion.rs` (osascript terminal
  launch, unit-tested) + `start_companion` command; `isCompanionLive`;
  title-bar Start action replacing/replaced-by the c0100 indicator; error
  surfaced via the banner. 8 of 9 criteria pass with tests; criterion 5 (live
  macOS click) left for the human — a started companion dispatches agent runs,
  so it isn't auto-fired.
- 2026-07-20 status → review (agent)
- 2026-07-21 status → done (app)
