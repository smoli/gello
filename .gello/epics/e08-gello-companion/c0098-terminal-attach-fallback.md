---
id: c0098
title: Terminal/attach interaction (fallback)
status: backlog
epic: e08
depends: [c0094, c0095]
created: 2026-07-19
updated: 2026-07-19
---

## What

The fallback interaction for when the human wants to **actively drive** an
agent (beyond the card-based Q&A). Launch the resumed interactive agent in a
terminal.

- Prefer a **detachable session** (tmux/PTY) when detected — run
  autonomously, `attach` to steer, detach — so it survives terminal close.
- **Fallback to a plain terminal window** when tmux/PTY isn't available
  (notably Windows). Session persistence still holds via the agent's session
  UUID (c0095), independent of the terminal.
- Cross-platform terminal spawn (macOS / Windows / Linux).

## Acceptance criteria

- [ ] A command/action launches the interactive agent for a card, resumed
      from its stored session UUID
- [ ] tmux/PTY is detected and used for a detachable session when available;
      otherwise a terminal window is opened
- [ ] Closing the terminal does not lose the session (UUID resume still works)
- [ ] Works on macOS, Linux, and Windows (window fallback on Windows)
- [ ] This path is optional — the companion runs fully without it (card Q&A
      is primary)

## Log

- 2026-07-19 created from the e08 companion breakdown
