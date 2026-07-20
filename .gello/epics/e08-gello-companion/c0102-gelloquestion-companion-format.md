---
id: c0102
title: Deterministic add-question tool + gelloquestion parse
status: backlog
type: task
created: 2026-07-19
updated: 2026-07-19
epic: e08
depends: [c0101]
---

## What

Parking a question must be **deterministic**. Teaching the agent a markdown
convention does not hold — on the first real run the agent wrote the old
`## Open question` format because that is what the prompt said. Replace the
convention with a **tool** that writes the block, and move the companion's
parse to the new format.

- **Shared core** — `addQuestion(root, card, markdown)` in `src/lib` writes a
  `gelloquestion` fenced block into the card and sets `awaiting: input` in one
  atomic write. This is the only place a question is ever formatted.
- **Two thin surfaces over that core** (pi has no MCP, see Discussion):
  - **Claude** — an MCP module in `src/lib` exposing `add_question`, hosted over
    **stdio**: by the companion for headless runs (the adapter wires the server
    per run), by the app when the GUI is up. [[c026]] becomes the app-hosted
    read surface over the same module.
  - **pi** — a `gello ask` CLI command doing the same thing, taught via a
    skill/README, which is pi's own recommended pattern.
- **Scoped to the run's card** — the tool takes only the markdown; the card is
  the one the run is for. An agent cannot park a question on another card.
- **Companion parse** — `companion/qa.ts` reads the `gelloquestion` fence and
  treats *answered* as the marker cleared / fence gone (the transition c0101's
  app write produces), then resumes the session.
- **Prompt slims down** — `buildTaskPrompt` stops teaching a markdown format; it
  says only *when* to ask (call the tool, then exit) and that the answer comes
  back un-fenced in the card.

## Acceptance criteria

- [ ] `addQuestion(root, card, markdown)` in the shared core writes the
      `gelloquestion` block + `awaiting: input` in one atomic write, and is the
      only code that formats a question
- [ ] The question is scoped to the run's card (markdown-only argument, or a
      supplied id validated against the run)
- [ ] Claude: an MCP stdio server exposes `add_question`; the adapter wires it
      per run
- [ ] pi: a `gello ask` CLI command does the same, taught via a skill/README
- [ ] `companion/qa.ts` parses the `gelloquestion` fence and detects the
      answered transition, then resumes
- [ ] `buildTaskPrompt` no longer teaches the markdown format, only the protocol
- [ ] c0096's `## Open question` parse path is retired or bridged
- [ ] End to end on both backends: agent calls the tool → the app pops the
      question (c0101) → human answers → companion resumes

## Discussion

- **Tool over convention** (human's call): an agent that is merely *told* a
  format gets it wrong — observed on the first real run. A tool makes the format
  the companion's job; the agent supplies only content.
- **pi has no MCP** (researched): pi's README states "No MCP. Build CLI tools
  with READMEs", while Claude CLI supports stdio, HTTP and SSE. So: one core,
  two surfaces. Rejected MCP-only (leaves pi, a first-class backend, on the
  unreliable convention) and CLI-only (drops typed tools for Claude).
- **stdio for the MCP surface**: no ports or lifecycle to manage, and the server
  is naturally scoped to the run. c026 proposed HTTP/SSE for the app; the app can
  host the same module over whichever transport suits it.
- **Shared module, either host** (human's call): the companion hosts it headless,
  the app hosts it when the GUI is up — matching the epic's "separate engine,
  shared core".
- **Locked to the run's card** (human's call): an agent cannot write a question
  onto an unrelated card.
- **Principle update**: the epic's "the companion is not a board editor" is
  refined — the **agent owns work writes** (status, Notes, Log); the
  **app and companion own the Q&A protocol writes** (question in via the tool,
  answer out via c0101). A deliberate, scoped exception.

## Open questions

- Where does `addQuestion` insert the block — top of the body, or above
  `## Log`? Proposed: near the top, so a raw file reads well.
- One open question at a time: replace an existing unanswered block, or refuse?
- Does `gello ask` ship inside the companion CLI or as its own entrypoint?
- Rebase c026 onto this module now, or after it exists?

## Log

- 2026-07-19 created (agent): split from the c0101 discussion — c0101 ships the
  app-side rendering + answer-write; this moves the companion parser + agent
  convention to the gelloquestion fence.
- 2026-07-19 discussed (agent): replace the prompt convention with a
  deterministic add-question tool. Shared core addQuestion(); MCP stdio surface
  for Claude, `gello ask` CLI for pi (pi has no MCP — researched); scoped to the
  run's card; qa.ts moves to the fence; prompt keeps protocol only. Epic
  principle refined: agent owns work writes, app/companion own Q&A protocol
  writes.
