---
id: c0104
title: companion being more verbose
status: review
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:26:07
epic: e08
---

## What

The companion prints only lifecycle lines today (which card it picked up, that
a question was parked, done/error) and hands the agent `stdio: "inherit"`, so
the agent's own output lands in the terminal raw and unlabelled. You can't see
what the agent is doing or what it costs. Give the companion real
observability, at three levels:

- **`quiet`** — the lifecycle lines it prints today, nothing else.
- **`normal`** (default) — plus one line per agent tool call (tool + its
  primary argument) and a token/cost summary when the run ends.
- **`verbose`** — plus the agent's assistant text as it streams.

**Mechanism.** Token counts aren't available through `inherit`; the companion
must pipe the agent's stdout and parse it. For claude that is
`-p --output-format stream-json --verbose` (the `--verbose` is required with
`--print`), which emits NDJSON: `system`, `assistant` (content blocks of
`text` or `tool_use` with the tool `name`), `user` (tool results),
`rate_limit_event`, and a final `result` carrying `usage`
(input/output/cache tokens), `total_cost_usd`, `num_turns`, `duration_ms`, and
`permission_denials`.

**Adapter-owned parsing.** `AgentAdapter` declares its stream capability and
supplies a parser that maps its backend's output to one backend-neutral event
type. claude gets the stream-json parser; pi (no structured stream) gets a
plain-text one — prefixed lines and text at `verbose`, no tool or token lines.

**Three surfaces.** The terminal rendering, per-run usage in
`.companion/state.json` (so the c0100 popover can show tokens/cost), and a
persisted `.companion/runs.log` for inspecting a finished run without
scrollback.

## Acceptance criteria

- [x] Three levels `quiet | normal | verbose`, default `normal` (selection
      source formalized in c0099)
- [x] The agent's stdout is piped rather than inherited, and every rendered
      line carries its card id — two concurrent runs at `wip_limits: 2` stay
      readable instead of interleaving
- [x] claude runs pass `--output-format stream-json --verbose`; the companion
      parses the NDJSON into a backend-neutral event stream
- [x] `normal` prints one line per agent tool call and a token/cost summary at
      run end
- [x] `verbose` additionally prints the agent's assistant text as it arrives
- [x] `quiet` prints only the lifecycle lines the companion prints today
- [x] An adapter declares its stream capability and supplies its parser; pi
      degrades to prefixed plain text without erroring
- [x] Per-run token/cost appears in the `runs` entries of
      `.companion/state.json`
- [x] Each run's events are appended to `.companion/runs.log` (gitignored)
- [x] An unknown or malformed stream event is skipped, never fatal to the run

## Discussion

- **Ladder and default** (human's call): `quiet` / `normal` / `verbose`, with
  `normal` on by default so calls and token counts are visible without
  opting in.
- **Piping is forced, and pays for itself**: token counts require parsing the
  structured stream, which means dropping `stdio: "inherit"`. The same change
  fixes the concurrency problem — today two agents write over each other
  unlabelled.
- **Parsing belongs to the adapter** (human's call): `stream-json` is
  claude-specific, so a shared parser would leak one backend's schema into the
  core. Each adapter declaring a capability keeps the abstraction honest and
  gives future backends a defined seam.
- **All three surfaces** (human's call). This makes the card large — see the
  split suggestion below.
- **Rejected**: keeping `stdio: "inherit"` (no token counts, and concurrent
  runs stay unreadable); a single shared stream parser in the core (couples
  the core to claude's schema).
- **Worth surfacing**: `result.permission_denials` would have made the
  headless-permission bug from the c0097 live run obvious on the first run.
  Denials belong in the `normal` output.
- **Open**: where the level is set (flag vs. env vs. board.yaml — c0099), and
  whether the app can set it when it launches the companion; whether the token
  summary is per-run only or also a session running total.
- **Suggested split** (for triage): (1) pipe + adapter-owned parse + terminal
  rendering with the three levels — the core of the card; (2) usage in
  `state.json` + the c0100 popover showing it; (3) `runs.log`. Card 1 stands
  alone and delivers most of the value.

## Notes

Implemented all three surfaces in one pass (the card was in `ready` whole, not
split).

- **`companion/stream.ts`** (new) — the backend-neutral `AgentEvent`
  (`text` | `tool` | `usage`) and `RunUsage`, the `Level` ladder, `LineBuffer`
  (reassembles NDJSON split across piped chunks), `renderEvent` (level-gated,
  `[cardId]`-prefixed), `formatUsage`, and `StreamSink` (parse → render → log →
  keep latest usage). Every unit tested.
- **`companion/adapters.ts`** — `AgentAdapter` gained `stream: StreamAdapter`
  (`printArgs` + `parse`). claude parses stream-json (`assistant` blocks →
  text/tool, `result` → usage incl. `permission_denials` count); pi maps each
  non-empty line to a text event. `printArgs` are added only in print mode, so
  interactive runs stay plain. `JSON.parse` of external NDJSON is narrowed with
  typed accessors — no `any`.
- **`companion/config.ts`** — added `level` (default `normal`, env
  `GELLO_COMPANION_LEVEL`, `companion.yaml` key; unknown value coerced back to
  default).
- **`companion/runner.ts`** — `SpawnedRun.onStdout?`; `start` wires a
  `StreamSink` per run; `RunState.usage` published (a parked run carries its
  tokens/cost so the c0100 popover can read it). `handleExit` takes the usage.
- **`companion/core.ts`** — `RunState.usage` field; `appendRunsLog` (plain
  append to `.companion/runs.log`).
- **`companion/main.ts`** — `nodeSpawner` now `stdio: ["ignore","pipe","inherit"]`
  (stdout piped, stderr inherited, stdin closed); wires `level`, `emit`
  (console) and `appendRunLog` (verbose-rendered transcript).
- **`src/lib/companion.ts`** — parse `usage` off runs defensively (drops garbage,
  keeps the run) so the app side is ready for it.

`.companion/runs.log` is gitignored by the existing `.gello/.companion/` rule.
Two unhandled rejections in `src/App.test.tsx` (c0083 auto-commit mock) are
pre-existing — confirmed unchanged with my edits stashed — and untouched here.

## Log

- 2026-07-20 status → discuss (app)
- 2026-07-20 discussed (human): three levels quiet/normal/verbose with normal
  as default; pipe the agent stdout and parse it (claude:
  `--output-format stream-json --verbose`); stream parsing owned by each
  adapter; three surfaces (terminal, state.json usage, runs.log). Verified the
  claude event shape and that `--print` + `stream-json` requires `--verbose`.
- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 status → review (agent)
