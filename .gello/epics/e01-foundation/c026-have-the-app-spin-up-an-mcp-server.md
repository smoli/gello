---
id: c026
title: Have the app spin up an mcp server
status: inbox
created: 2026-07-16
updated: 2026-07-20
status-changed: 2026-07-20T17:49:47
epic: e01
---

Providing tools for

* Discovering cards in ready

## What

The running desktop app hosts an **MCP server** (HTTP/SSE, bound to
localhost) so an agent working alongside the human can query the board
through typed tools instead of grepping `.gello/`. The server's lifecycle is
tied to the app: it starts when the UI launches and stops when it quits —
there's no separate daemon.

Scope for this card is **read-only discovery**. Board mutation (move, create,
edit) stays as file edits for now; write tools can be a follow-up once the
read surface is proven.

**Endpoint discovery is manual**: the app shows the MCP endpoint (URL/port)
in the gello UI; the human copies it into their agent's MCP config. No
written config file, no auto-discovery — the human is the courier.

**Tools return raw card Markdown, not a typed schema.** A tool hands back the
card's file content (frontmatter + body) and the *agent* parses the
frontmatter itself — agents are already good at reading gello cards, and it
keeps the server from re-implementing the board's TypeScript parsing. The
server's job is *selection* (which card), using the app's live, already-
ordered board model; interpretation is the agent's.

First tools (read-only):

- **get_highest_priority_issue** — the issue (`type: issue`) at the top of
  the `ready` column, by the board's ready ordering (c056).
- **get_highest_priority_card** — the same for a task/card (`type: task`).

Both return the selected card's raw Markdown. Further discovery tools (list
by status, search) are natural follow-ons but these two are the starting
point.

The selection reflects the live board the human sees (the app's model over
`.gello/`), so external edits and manual reordering are honoured.

## Acceptance criteria

- [ ] The app starts an MCP server (localhost HTTP/SSE) on launch and stops
      it on quit; nothing binds when the app isn't running
- [ ] The gello UI displays the MCP endpoint so the human can copy it into
      their agent's MCP config
- [ ] Exposes `get_highest_priority_issue` and `get_highest_priority_card`,
      each returning the top card of the `ready` column for its type as raw
      Markdown (frontmatter + body)
- [ ] "Top of ready" follows the board's ready ordering (c056 manual order),
      i.e. the same card the human sees at the top of the ready column
- [ ] The tool returns raw Markdown; the server does not impose a typed
      output schema (the agent parses frontmatter itself)
- [ ] Selection reflects current board state — an external edit or a reorder
      is honoured on the next tool call without restarting the server
- [ ] Server binds to localhost only; tools are read-only (no mutation in
      this card's scope)
- [ ] Empty ready column (for that type) returns a clean "nothing ready"
      result, not an error

## Discussion

- **App-hosted HTTP/SSE, runs with the UI** (user's call): the agent gets
  board tools exactly while it's working next to the human in the app; no
  standalone server to manage. Trade-off: no app open → no MCP, which is
  fine for the "agent + human at the board together" use.
- **Read-only first**: discovery is the high-value, low-risk surface (an
  agent finding what to pick up). Writes are riskier and already possible via
  file edits, so they're deferred rather than rushed in.
- **Agent parses, server selects**: tools return raw card Markdown and the
  agent interprets it, so the server never re-implements the board's
  TypeScript frontmatter parsing. The one thing the server must know —
  ready-column ordering — comes from the app's live model (already parsed
  and ordered for the UI), not a second parser. This resolves the
  "where does parsing live" question: it stays in the frontend model; the
  server reads selection from there and passes raw content through.
- **Manual endpoint hand-off**: the UI shows the endpoint and the human
  copies it to the agent — no discovery file to keep in sync, and it's an
  explicit, visible step (the human is connecting a specific agent to a
  specific running board).
- **No premature shared core**: c026 overlaps [[c020]] (CLI) and [[c0069]]
  (headless server) — all are non-GUI ways to drive the board. Per the
  user, build MCP as its own thing now and reconcile common implementation
  later, when duplication actually hurts, rather than designing a grand
  shared core up front.
- **Open**: whether "top of ready" should also require `depends` all `done`
  (the fuller pick-up-work convention) or stay purely positional; MCP
  transport specifics (SSE vs. streamable HTTP); how the Rust host obtains
  the frontend's ordered model (push-on-change vs. request); whether write
  tools and more discovery tools (list/search) become follow-up cards.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): app-hosted localhost MCP over HTTP/SSE,
  lifecycle tied to the UI; read-only discovery; shared core with
  CLI/headless deferred
- 2026-07-17 refined (human): endpoint shown in UI + hand-copied to the
  agent; tools return raw Markdown (agent parses), server only selects using
  the app's ordered model; first tools = get_highest_priority_issue /
  get_highest_priority_card (top of ready by type)
- 2026-07-20 status → inbox (app)
