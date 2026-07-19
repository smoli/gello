---
id: c0102
title: gelloquestion format — companion parser + agent convention
status: backlog
type: task
created: 2026-07-19
updated: 2026-07-19
epic: e08
depends: [c0101]
---

## What

Move the card Q&A format from c0096's `## Open question` block to the
`gelloquestion` fenced block that c0101 renders and answers. The app already
un-fences + clears `awaiting` on answer; this card makes the companion and the
agent speak the new format so Q&A works end to end.

- **Companion parser** (`companion/qa.ts`): parse the `gelloquestion` fence
  instead of the `## Open question` heading; detect "answered" as the marker
  cleared / fence gone (the app's transition), and resume the session.
- **Agent convention** (c0099 companion system prompt / skill): agents write a
  question as a ` ```gelloquestion ` block (question + checkbox/open slots) and
  set `awaiting: input`; on resume they read the un-fenced answer and continue.
- Reconcile with `## History` (c0096): decide whether resolved turns stay in
  place (un-fenced) or get archived — proposed: stay in place, agent may
  reorganize.

## Acceptance criteria

- [ ] The companion parses a `gelloquestion` block and detects the answered
      transition (`awaiting` cleared), then resumes
- [ ] The agent convention documents the `gelloquestion` format (write + read)
- [ ] c0096's `## Open question` parse path is retired or bridged
- [ ] End-to-end: agent parks a gelloquestion → human answers in the app →
      companion resumes

## Log

- 2026-07-19 created (agent): split from the c0101 discussion — c0101 ships the
  app-side rendering + answer-write; this moves the companion parser + agent
  convention to the gelloquestion fence.
