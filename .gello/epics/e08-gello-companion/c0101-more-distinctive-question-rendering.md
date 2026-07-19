---
id: c0101
title: More distinctive Question rendering
status: ready
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T21:02:47
epic: e08
---

## What

Render and answer an agent's question distinctively in the card detail, and
change the on-disk question format to a fenced block.

- **Format** — the agent parks a question as a fenced code block tagged
  `gelloquestion` whose content is markdown: the question text plus answer
  slots (a checkbox list `- [ ]` for a choice, a plain text slot for an open
  question). This replaces c0096's `## Open question` heading block. The
  `awaiting: input` frontmatter marker still flags a parked question (drives
  the board "needs input" badge, c0100).
- **Auto-answer popup** — opening a card whose `gelloquestion` is unanswered
  pops a modal scoped to that one question. The user can **Answer** it or
  **Cancel for now**.
- **On Answer** — the app writes the answer into the block, **un-fences** it
  (strips the ```` ```gelloquestion ```` delimiters so the resolved Q&A becomes
  plain markdown in place), and clears `awaiting: input`, in one atomic write.
  The companion detects the transition and resumes the session.
- **On Cancel** — the modal closes and the card renders normally. The
  `gelloquestion` shows as a distinct **read-only question panel** with an
  **Answer** button to reopen the popup. The rest of the card stays editable —
  no hard lock; the user can edit the card or defer the question.

## Acceptance criteria

- [ ] A `gelloquestion` fenced block renders in the card detail as a distinct
      question panel (not a raw code block); choice slots render selectable, an
      open question shows a text slot
- [ ] Opening a card with an unanswered `gelloquestion` auto-opens an answer
      modal scoped to that question
- [ ] The modal offers Answer and Cancel; Cancel closes it and shows the card
      (editable), with an Answer button on the panel to reopen
- [ ] Answering writes the answer, removes the `gelloquestion` fence
      (un-fenced markdown remains in place), and clears `awaiting: input` in one
      atomic, watcher-safe write (c015)
- [ ] A resolved (answered) card opens normally — no auto-popup; the un-fenced
      content shows as ordinary card body
- [ ] A card with no `gelloquestion` opens normally, no modal
- [ ] Companion + board badge still key off `awaiting: input`; the companion
      resumes on the answered transition (needs the format/parse update)

## Discussion

- **`gelloquestion` fence over the `## Open question` heading** (human's call):
  one fenced region is a cleaner demarcation, reads well in a raw editor, and
  un-fencing on answer turns the resolved turn into plain markdown in place.
  This reopens the c0096 format contract — the companion parser and the agent
  convention (c0099) move to the fence.
- **Auto-popup, answer-only** (human's call): opening a card with an unanswered
  question pops a modal for just that question. Not a hard edit-lock — after
  Cancel the card is fully editable and the panel keeps an Answer button.
  (Rejected: locking the whole card read-only until answered — too heavy.)
- **App un-fences and clears the marker** (human's call): the app writes the
  answer (un-fence + clear `awaiting`) so feedback is immediate and the
  companion only detects the transition. A deliberate exception to the epic's
  "agent owns card writes" principle, scoped to answering.

## Open questions

- Answer-write shape: for a choice, check the picked box; for an open question,
  append the typed text — settle when building.
- Does the un-fenced turn stay in place or move to `## History`? Proposed: stay
  in place; the agent may reorganize on resume.
- Assume one active `gelloquestion` per card (one open turn) for now.
- Dependency: the companion parser + agent convention change (reopen c0096 /
  fold into c0099) — triage alongside this card.

## Log

- 2026-07-19 status → discuss (app)
- 2026-07-19 discussed (agent): adopt a `gelloquestion` fenced-block format;
  auto-popup to answer only that question on open (Answer / Cancel-for-now);
  the app un-fences + clears `awaiting` on answer (companion resumes); Cancel
  leaves the card editable with an Answer affordance. Reopens the c0096 format
  contract (companion parser + agent convention c0099).
- 2026-07-19 status → ready (app)
