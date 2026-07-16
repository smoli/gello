---
id: c027
title: Discuss status
status: review
priority: normal
created: 2026-07-16
updated: 2026-07-16
milestone: m01
---

## What

A `discuss` status/column: the human flags a card they want to think through
with an LLM before it becomes implementable. The discussion enriches the card
itself — refined What, drafted acceptance criteria, recorded decisions — so
the card carries its own context into implementation, across sessions.

Position in the flow: **triage stage** — inbox → discuss → milestone →
backlog. Ideas are discussed before they're assigned a home.

## Acceptance criteria

- [x] `discuss` is a board column (first status column, before backlog)
- [x] The agent workflow is documented in CLAUDE.md: find flagged cards,
      interview the human, write back refined What / criteria / a compact
      `## Discussion` section (decisions + rejected alternatives, no
      transcript), exit is the human's call
- [x] concept.md documents the column and the card-format status list
- [x] Zero app-code changes (columns are config; c005 renders them)
- [x] Convention demonstrated on a real card (this one)

## Discussion

Held 2026-07-16 (Stephan + agent) — this card was worked by discussing it.

**Decisions:**
- Convention-only v1: board.yaml + CLAUDE.md. No in-app LLM chat — that would
  be real feature work (API keys, streaming, transcripts) and overlaps with
  c026 (MCP server) territory.
- Discuss is a *triage* stage (inbox → discuss → milestone → backlog), not a
  pre-ready refinement between backlog and ready. The discussion decides
  whether/where a card belongs at all.
- Output format: rewrite `## What`, draft `## Acceptance criteria`, add
  `## Discussion` with decisions and rejected alternatives. No verbatim
  transcripts — cards must stay readable.

**Rejected alternatives:**
- In-app chat panel (deferred, see c026 for the integration direction)
- discuss between backlog and ready (didn't match the intended flow)
- Full transcripts in cards (signal drowns)

**Open question (filed as c029):** inbox cards with a non-backlog status are
only visible in the inbox column — a discuss-flagged inbox card doesn't show
in the discuss column. Agents find it via grep, but the human doesn't see the
pipeline. Candidate rule: inbox cards whose status is not backlog also render
in their status column (inbox-badged).

## Log

- 2026-07-16 captured via quick capture (Stephan), triaged to m01
- 2026-07-16 picked up (agent), discussed live, convention shipped, status → review
