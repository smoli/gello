---
id: c0096
title: Card-based Q&A protocol (primary interaction)
status: in-progress
epic: e08
depends: [c0094, c0095]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T10:45:00
---

## What

The primary way the agent and human interact — **through the card**, async,
no chat UI. Turn-based: the agent asks (turn 1), the human answers, the agent
uses the answers and may ask again (turn 2), … The card layout keeps the
*current* turn prominent and editable while preserving the conversation.

**Card layout** (files-first, so it reads well in a raw editor too):

- **`## Open question`** — a block pinned near the top holding **only the
  current turn**. The agent writes its question(s) here with answer slots:
  **checkboxes** where the question is a choice (`- [ ] option A`), a text
  slot for open questions. While a turn is open, a frontmatter marker
  (`awaiting: input`) is set.
- **`## History`** — resolved turns below, each labelled (`### Turn N`) with
  its question and the given answer, newest-first. Collapsed in the app.

**Flow**:

- **Ask**: the agent writes the turn into `## Open question`, sets the marker,
  and exits (its session UUID is stored, c0095).
- **Answer**: the human fills the answer slots in `## Open question` (checks
  boxes / types) — in the app or a raw editor.
- **Resume**: the companion watches the card; when the open turn is **fully
  answered**, it resumes the session (c0094) with the answers.
- **Archive**: on resume the agent moves the answered turn into `## History`,
  clears the marker, and either opens a new `## Open question` (loop) or
  finishes.

**Division of labour** (epic principle — the agent owns card writes): the
**agent writes** the open question, the history archiving, and the marker; the
**companion only reads** to detect the answered transition and to resume. The
convention is taught to the agent (companion system prompt / a skill).

## Acceptance criteria

- [ ] Documented format: an `## Open question` block (question text + answer
      slots — checkbox list for choices, a text slot for open questions) and
      the `awaiting: input` frontmatter marker
- [ ] The companion parses the open turn and detects when it is **fully
      answered** (all checkboxes resolved / text slots filled), then resumes
      the session with the answers
- [ ] An unanswered open turn does not resume (no spurious resume)
- [ ] Multiple turns work (park → answer → resume → archive → park …);
      `## History` accumulates resolved turns labelled by turn
- [ ] On resume the answered turn is archived to `## History` and the marker
      cleared (agent-side, per the convention)
- [ ] The open-question / marker is exposed for the app: the open turn renders
      prominent + editable, resolved turns collapsed (the app rendering is
      card-detail work — may land with c0100 or a small card-detail addition;
      the format here is the contract)

## Discussion

- **Open-question block + separate History** (user's call): the current turn
  is always in one prominent, editable place — great in the app *and* in a
  raw editor (no scrolling to the bottom to find the open question). Resolved
  turns are preserved but out of the way. (Rejected: interleaved chronological
  turns — buries the open question at the bottom in a raw editor.)
- **Checkboxes where the question is a choice**, free text otherwise — reuses
  gello's checkbox convention for the common "pick one/some" case.
- **Agent writes, companion reads**: card mutations stay with the agent (epic
  principle). The companion only detects the answered transition and resumes,
  so it never becomes a card editor. The agent learns the convention from the
  companion's system prompt (or a bundled skill).
- **App rendering is card-detail work**: the open turn prominent + editable,
  resolved turns collapsed — lands with c0100 or a small card-detail
  addition. This card owns the *format contract* and the companion-side
  parse/resume.

## Notes

This is the on-brand core: reuses cards + the watcher + session-resume, and
adds no chat UI (c0073's constraint). The terminal path (c0098) is only for
active steering.

- **Open**: exact marker field name (`awaiting: input`?); `## History`
  ordering (newest-first chosen); how the agent is taught the convention
  (system prompt vs. a bundled skill).

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)
- 2026-07-19 discussed (human): turn-based Q&A; `## Open question` block
  (current turn, checkboxes + text slots, `awaiting` marker) pinned on top +
  `## History` (resolved turns, collapsed); agent writes / companion reads;
  app renders open turn prominent, history collapsed.
