---
id: c0103
title: Free text on every answer, alongside the choices
status: review
type: task
created: 2026-07-20
updated: 2026-07-20
epic: e08
depends: [c0101]
status-changed: 2026-07-20T08:09:20
---

## What

The answer popup offers checkboxes *or* a text box, decided by whether the
agent wrote `- [ ]` lines. A choice question therefore gives the human no way
to say anything the agent did not anticipate — "neither, do X instead", or the
reason behind the pick, which is usually the useful part.

Always offer free text. On a choice question it sits under the options and is
optional; on an open question it is the whole answer, as now.

This revises c0096's "checkboxes where the question is a choice, free text
otherwise".

## Acceptance criteria

- [x] The popup shows a free-text field for every question, choice or not
- [x] A choice question can be answered with options only, text only, or both
- [x] Text-only on a choice question leaves every box unchecked
- [x] The un-fenced result keeps the checked boxes and appends the text below
- [x] Answer stays disabled until there is something to submit

## Log

- 2026-07-20 created (agent): from the human, after c0102 went to review.
- 2026-07-20 implemented (agent): GelloAnswer collapsed from a choice/open
  union into one `{ selected, text }` shape — the union was what forced the
  either/or. `answeredInner` checks the boxes then appends the note; the modal
  always renders the textarea and enables Answer on either half. Also corrected
  the companion README, which told agents a checkbox question is answered by
  checkboxes alone.
- 2026-07-20 status → review (agent)
