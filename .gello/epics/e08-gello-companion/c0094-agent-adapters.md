---
id: c0094
title: Agent adapters — Claude & pi
status: done
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T14:59:34
---

## What

A small adapter interface abstracting an agent backend, with **Claude CLI**
and **pi CLI** implementations. The rest of the companion talks to agents
only through this interface.

The interface covers:

- **start** a new session for a task (returns a session id/UUID).
- **resume** an existing session by its stored UUID with new input.
- build the **launch invocation** (headless run vs. interactive terminal
  command — the latter used by the c0098 fallback).

## Acceptance criteria

- [x] An `AgentAdapter` interface with a `build({sessionId, prompt, mode})`
      launch-command builder. Design shift: both CLIs accept a **caller-owned
      session id** that creates-if-new / resumes-if-exists, so start and
      resume collapse into one build with an owned id (companion generates it
      — `newSessionId`, c0095) — no id to parse back
- [x] A **Claude CLI** adapter (`claude --session-id <uuid> [-p] <prompt>`);
      flags confirmed against `claude --help` (`--session-id`, `-p`)
- [x] A **pi CLI** adapter (`pi --session-id <id> [-p] <prompt>`); confirmed
      against `pi --help` (`--session-id` "creating it if missing", `-p`)
- [x] Backend selectable via `getAdapter(name)` (`claude` | `pi`); the config
      *source* lands in c0099
- [x] `getAdapter` throws a clear error for an unknown backend; the prompt is
      a single argv element (spawn without a shell — no escaping) so odd
      prompts can't break out

## Notes

- `companion/adapters.ts`: `AgentAdapter` + `RunRequest`/`LaunchSpec`,
  `claudeAdapter`/`piAdapter` (share the `--session-id [-p] <prompt>` shape),
  `getAdapter` + `ADAPTER_NAMES`. 8 tests on command construction.
- **Verified** the real flags exist via `claude --help` and `pi --help`
  (`--session-id` on both, `-p`/`--print`, plus `--resume`). Did **not**
  execute agents (would need auth/tokens; the user is AFK) — this card is
  pure command construction, exercised end to end by the tests. Actually
  *running* an agent is c0097; a live multi-turn run should confirm the
  create-or-resume semantics before c0097 relies on them.
- 531 tests green, typecheck + lint clean.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)

- 2026-07-19 status → ready (app)
- 2026-07-19 implemented TDD (agent): adapters.ts (claude/pi, caller-owned
  session id, getAdapter) + newSessionId; flags verified via --help, command
  construction tested (not executed). 531 green; status → review
- 2026-07-19 status → done (app)
