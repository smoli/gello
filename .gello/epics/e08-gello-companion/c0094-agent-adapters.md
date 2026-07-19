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

- [x] An `AgentAdapter` interface with a `build({sessionId, prompt, mode,
      resume})` launch-command builder. The companion owns the session id
      (`newSessionId`, c0095) — no id to parse back. **Correction (c0097 live
      run):** start and resume do *not* collapse into one flag — see below.
- [x] A **Claude CLI** adapter: new session `claude --session-id <uuid> [-p]`,
      resume `claude --resume <uuid> [-p]`. `--session-id` *creates* and errors
      ("already in use") if the id exists, so resume must use `--resume`.
- [x] A **pi CLI** adapter (`pi --session-id <id> [-p] <prompt>`, new *and*
      resume); pi's `--session-id` is idempotent ("creating it if missing"), so
      it serves both.
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
- 2026-07-19 **fix (c0097 live run)**: the "one flag creates-or-resumes"
  assumption was wrong for claude — `--session-id <id>` errors "already in
  use" on an existing id. Added `resume` to `RunRequest`; claude now uses
  `--resume` for an existing session, pi keeps its idempotent `--session-id`.
  The runner derives resume-vs-new from whether a session id already exists
  (covers answered-turn resume *and* companion-restart re-dispatch).
  Reproducing adapter test added.
- 2026-07-19 status → done (app)
