---
id: c0096
title: Card-based Q&A protocol (primary interaction)
status: backlog
epic: e08
depends: [c0094, c0095]
created: 2026-07-19
updated: 2026-07-19
---

## What

The primary way the agent and human interact — **through the card**, async,
no chat UI. When the agent needs the human, it parks a question into the
card; the human answers in the card; the companion auto-resumes the session.

- **Ask**: the agent writes its question into the card's `## Questions`
  section and sets a **"needs input" marker** (a frontmatter field, e.g.
  `awaiting: input`), then exits — its session UUID is stored (c0095).
- **Watch**: the companion watches the card; when the human's **answer**
  appears under the question (and the card is no longer "unanswered"), it
  clears the marker and **auto-resumes** the session (c0094 resume) with the
  answer as input.
- The agent continues; may ask again (loop) or finish.

## Acceptance criteria

- [ ] A documented `## Questions` format (question + a place for the answer)
      and a frontmatter "needs input" marker the agent sets when it parks
- [ ] The companion detects a human answer to a parked question and resumes
      the session with it, clearing the marker
- [ ] Multiple question/answer rounds on one card work (park → answer →
      resume → park …)
- [ ] An unanswered parked card stays parked (no spurious resume) until a real
      answer is written
- [ ] The "needs input" marker is exposed for the board badge (c0100)

## Notes

This is the on-brand core: reuses cards + the watcher + session-resume, and
adds no chat UI (c0073's constraint). The terminal path (c0098) is only for
active steering.

## Log

- 2026-07-19 created from the e08 companion breakdown
