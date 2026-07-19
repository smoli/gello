---
id: e08
title: Gello-Companion
status: backlog
---

## Goal

Companion cli app that acts as an agent runner. Reacting to board changes, spinning up agents, keeping agent sessions.

**Design decisions** (from the e08 planning discussion):

- **Architecture: separate engine, shared core.** The companion is a
  standalone **Node CLI reusing the board core in `src/lib`**
  (loader/watcher/session) — realizing and absorbing [[c020]]'s "tiny gello
  CLI". It runs **headless** (agents work with the GUI closed), on a server
  or over SSH. The desktop app can **launch it as a child process via a
  one-click toggle** for convenience; power users run it standalone. The app
  and companion coordinate only through `.gello/` files (state file + cards),
  never a direct process link.
- **Trigger**: a card entering `ready` dispatches an agent run (the board's
  existing go-signal).
- **Sessions = agent-native session UUIDs**, not tmux. pi and Claude CLI both
  persist resumable sessions keyed by a UUID, so context survives terminal
  close without any extra dependency. The companion stores the UUID and
  resumes. Scope is **configurable: per card (default) or per epic**.
- **Backends**: Claude CLI and pi CLI from the start, behind a common adapter
  (start / resume-by-UUID / interactive-launch).
- **Interaction is card-based first, no chat UI** (the board *is* the async
  chat): when the agent needs the human, it writes the question into the
  card's `## Questions` section and **parks** (session UUID stored); the card
  gets a "needs input" marker/badge. The human answers in the card; the
  companion watches, detects the answer, and **auto-resumes** the session
  with it. A **detachable terminal** (tmux/PTY when available, a plain
  terminal window otherwise — incl. Windows) is the **fallback** for when you
  want to actively drive the agent, not the default.
- **Board work stays the agent's**: the launched agent, following gello's
  conventions, moves the card and writes Notes/Log. The companion dispatches
  and manages sessions; it is not itself a board editor.
- **App shows runner status (no chat)**: the companion **publishes its state
  to a file in `.gello/`** (which run is active, attached vs. detached, a
  low-key "what's happening" line). The desktop app watches it and shows a
  **small title-bar icon** that changes with state; clicking it opens a
  popover with more detail. Files-are-truth, so the app just reads and
  renders — no direct coupling to the companion process.

## Definition of done

- A standalone companion CLI watches `.gello/`; a card entering `ready`
  dispatches an agent run for that card.
- Runs resume from a stored session UUID (per card or per epic, per config),
  so context persists across runs and terminal close.
- Claude CLI and pi CLI both work via the adapter.
- **Card-based Q&A works end to end**: the agent parks a question into the
  card, the human answers, the companion auto-resumes the session. A "needs
  input" marker shows on the board.
- A terminal/attach fallback exists for active steering (detachable tmux/PTY
  when available, terminal window otherwise); no chat UI in the desktop app.
- The board reflects run/session state; the agent does the card mutations.
- The companion publishes its state to a `.gello/` file; the app shows a
  title-bar runner icon (state-driven, incl. "waiting for input") with a
  click-through detail popover.

## Plan (steps + dependencies)

1. **c0093 — Companion scaffold + board watcher + state file** (root).
   Standalone **Node CLI on the shared `src/lib` core** (absorbs c020) that
   watches `.gello/`, detects a card entering `ready`, and defines/publishes
   the `.gello/` state-file contract (idle to start). Everything depends on
   this.
2. **c0094 — Agent adapter interface + Claude & pi adapters** (← c0093).
   start / resume-by-UUID / launch, per backend.
3. **c0095 — Session store: UUID per card/epic, configurable** (← c0093).
   Persist card/epic → session UUID; per-project session-scope config.
4. **c0096 — Card-based Q&A protocol** (primary interaction) (← c0094, c0095).
   The `## Questions` section format + a "needs input" frontmatter marker; the
   agent parks a question and exits; the companion watches the card, detects
   the human's answer, and auto-resumes the session with it.
5. **c0097 — Dispatch flow: ready → pick up → run → write-back**
   (← c0093, c0094, c0095, c0096). Wire the trigger to a run; integrate the
   Q&A park/resume lifecycle; the agent does the board work; respect WIP.
6. **c0098 — Terminal/attach interaction (fallback)** (← c0094, c0095).
   Launch the resumed interactive agent in a terminal for active steering;
   detachable tmux/PTY when detected, terminal-window fallback (incl. Windows).
7. **c0099 — Config & docs / packaging** (← c0093). Per-project companion
   config, README, install path.
8. **c0100 — App: title-bar runner indicator + needs-input badge** (← c0093).
   Desktop app reads the `.gello/` state file and shows a small title-bar icon
   that changes with runner state (idle / running / waiting-for-input /
   attached / attention); click → popover with per-run detail; a per-card
   badge for the Q&A "needs input" marker. App-side; buildable against the
   c0093 state contract early.

## Source

Broken down from the e08 planning discussion (companion as agent runner;
ready-trigger; agent-UUID sessions per card/epic; Claude+pi adapters;
**card-based Q&A as the primary interaction** with a terminal/attach
fallback; app title-bar runner indicator). Related: [[c0073]] (drive the CLIs
from the board, no chat UI, keep sessions).

