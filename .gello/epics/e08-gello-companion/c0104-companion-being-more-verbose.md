---
id: c0104
title: companion being more verbose
status: discuss
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T08:24:24
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

- [ ] Three levels `quiet | normal | verbose`, default `normal` (selection
      source formalized in c0099)
- [ ] The agent's stdout is piped rather than inherited, and every rendered
      line carries its card id — two concurrent runs at `wip_limits: 2` stay
      readable instead of interleaving
- [ ] claude runs pass `--output-format stream-json --verbose`; the companion
      parses the NDJSON into a backend-neutral event stream
- [ ] `normal` prints one line per agent tool call and a token/cost summary at
      run end
- [ ] `verbose` additionally prints the agent's assistant text as it arrives
- [ ] `quiet` prints only the lifecycle lines the companion prints today
- [ ] An adapter declares its stream capability and supplies its parser; pi
      degrades to prefixed plain text without erroring
- [ ] Per-run token/cost appears in the `runs` entries of
      `.companion/state.json`
- [ ] Each run's events are appended to `.companion/runs.log` (gitignored)
- [ ] An unknown or malformed stream event is skipped, never fatal to the run

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

## Log

- 2026-07-20 status → discuss (app)
- 2026-07-20 discussed (human): three levels quiet/normal/verbose with normal
  as default; pipe the agent stdout and parse it (claude:
  `--output-format stream-json --verbose`); stream parsing owned by each
  adapter; three surfaces (terminal, state.json usage, runs.log). Verified the
  claude event shape and that `--print` + `stream-json` requires `--verbose`.
