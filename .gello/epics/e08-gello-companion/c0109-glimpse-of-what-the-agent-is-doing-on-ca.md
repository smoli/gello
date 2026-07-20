---
id: c0109
title: Glimpse of what the agent is doing on cards
status: in-progress
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T22:46:22
epic: e08
depends: [c0104]
---

## What

A card with a running agent shows one small, live-updating line of what that
agent is doing right now — "Editing runner.ts", "Running pnpm test", "Reading
board.ts", "Thinking…". Enough to glance at the board and see work moving.

The mechanism already exists: c0104 pipes the agent's stdout and parses it into
a backend-neutral `AgentEvent`, where a tool call is
`{ kind: "tool", name, arg? }` and `primaryArg` has already picked the most
informative argument (`command`, `file_path`, `path`, `pattern`, …). This card
is the remaining three steps: carry the latest tool event to the app, phrase
it, and render it.

- **Transport** — `RunState` gains an optional `activity: { name, arg? }`,
  published in `.companion/state.json` beside `phase` and `usage`. The
  companion coalesces events and rewrites the file at most once a second; the
  app keeps its existing 2s poll (c0100). A second or two of lag is what a
  glimpse needs.
- **Phrasing is the app's job** — the companion publishes the structured pair,
  not a sentence. The app maps tool → verb (`Edit`/`Write` → "Editing",
  `Bash` → "Running", `Read` → "Reading", `Grep`/`Glob` → "Searching",
  `set_status` → "Updating status", `add_question` → "Asking a question"),
  prefers a path's basename, and truncates to the card width.
- **Never on the card file.** The activity is runtime state, published only in
  `state.json`. It is not written into the card markdown — the companion does
  not edit cards.

## Acceptance criteria

- [ ] `RunState` carries an optional `activity: { name, arg? }` for a running
      run, published in `.companion/state.json`
- [ ] The companion coalesces activity updates and rewrites the state file at
      most about once a second, however fast the agent emits events
- [ ] The app parses `activity` defensively — garbage is dropped and the run is
      kept (same contract as `usage`)
- [ ] A card whose run is `running` shows a one-line activity phrased from the
      tool, preferring a path's basename, truncated to one line
- [ ] A `running` run with no tool call yet shows "Thinking…"
- [ ] A parked (`waiting-for-input`) run shows no activity line — the c0100
      needs-input badge already says that
- [ ] No activity line when the companion isn't running (no state file)
- [ ] When the state file's `updated` goes stale (~30s), each affected card's
      line is marked stale rather than presented as current
- [ ] The activity never appears in the card's markdown

## Notes

- 2026-07-20 (agent) Plan: three layers.
  - **Transport** (companion): `stream.ts` gains an `Activity` type and the
    `StreamSink` tracks the latest tool event (callback + getter); `core.ts`
    `RunState` gains `activity?`; a new `throttle.ts` (leading+trailing, ~1s)
    coalesces publishes; the `Runner` records each tool event onto its active
    run and publishes through the throttle. Activity is emitted into
    `state.json` only while a run is `running` (parked/done runs drop it).
  - **Parse** (app): `companion.ts` parses `activity` defensively — a `name`
    string is required, `arg` copied only when a string; garbage drops the
    field, keeps the run (same contract as `usage`).
  - **Phrasing + render** (app): new `activity.ts` maps tool→verb, prefers a
    path basename, truncates; `cardActivity()` returns the line + a stale flag
    (`updated` older than ~30s). The card front renders it; a `running` run
    with no tool yet shows "Thinking…"; a parked run shows nothing.
- **Open questions resolved from the card body, not asked**: phrasing stays
  app-side presentation (the "What" says so — not shared with the CLI's
  `renderEvent`). Scope is the board **card front** (the "glance at the board"
  use); the epic/detail views are left for a follow-up — the acceptance
  criteria are all about the card.

## Discussion

- **Depends on c0104** (human's call): c0104 delivers the pipe, the
  adapter-owned parse, and the `AgentEvent` type. c0109 is mapping, transport,
  and rendering on top. Rejected: folding the two together (c0104 was already
  large), and flipping the dependency.
- **Structured contract, app-side phrasing** (human's call): `state.json` is a
  contract between two processes, so it carries `{ name, arg }` rather than a
  sentence. Card width is the app's concern, and rewording shouldn't need a
  companion release. Rejected: a pre-formatted string; publishing both.
- **Throttle, don't re-plumb** (human's call): ~1s coalesced writes plus the
  existing 2s poll. Rejected: a second `activity.json` with its own faster
  poll, a 500ms poll, and a Rust watcher — c0100 deliberately avoided watching
  `.companion/`, which appears and vanishes with the process.
- **Stale warns on the card** (human's call): a crashed or wedged companion
  would otherwise leave "Running tests…" pinned to a card forever, so the
  warning goes where the misleading text is. Rejected: hiding the line (loses
  where the run got stuck) and a title-bar-only signal.
- **Open**: whether the tool→verb map is shared with the CLI's rendering or
  stays app-side presentation; whether the epic and detail views show it too.

## Log

- 2026-07-20 status → discuss (app)
- 2026-07-20 status → backlog (app)
- 2026-07-20 discussed (human): depends on c0104's stream parse; companion
  publishes structured `activity: {name, arg}` in `state.json` throttled to
  ~1s (the existing 2s poll kept); the app phrases it (verb + basename) and
  marks the line stale when the state file ages out.
- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
