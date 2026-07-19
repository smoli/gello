---
id: c0100
title: App — title-bar runner indicator + needs-input badge
status: in-progress
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T20:50:00
---

## What

Desktop-app surface for the companion — low-key, no chat UI. The app reads
the companion's `.gello/` state file (c0093) and shows a **small title-bar
icon** that changes with runner state, plus a **per-card "needs input"
badge** for parked Q&A (c0096).

- Title-bar icon states: **idle / running / waiting-for-input / attached /
  attention** — a low-key glyph that changes with the state file.
- Click → a **popover** with per-run detail (which card, phase, session).
- Card fronts show a **"needs input"** badge when the card has a parked
  question (the c0096 marker).
- App-side only; buildable early against the c0093 state-file contract with a
  hand-written fixture, before the runner exists.

## Acceptance criteria

- [x] The app reads the companion state file and shows a title-bar icon
      reflecting runner state (idle / running / waiting). *attached / attention
      arrive with the terminal path (c0098); the glyph map is open for them.*
- [x] Clicking the icon opens a popover listing active runs with their phase
- [x] No indicator when there's no companion state file (companion not
      running) — `readCompanionState` → null → nothing rendered
- [x] Card fronts show a "needs input" badge when the card is parked awaiting
      an answer — driven by the card's own `awaiting: input` marker (c0096)
- [x] Sits beside the c0083 dirty-worktree indicator without layout clashes
      (rendered in `titlebar-left` right after the dirty dot)

## Notes

Same title-bar surface and file-watch pattern as the c0083 dirty dot — keep
them visually consistent.

**Two signals, two sources** (don't cross them): the **per-card badge** reads
the card's own `awaiting: input` frontmatter marker (c0096), so it works even
when the companion isn't the one running (a raw-editor session, a manually
parked card) — the badge must not depend on the companion process being alive.
The **title-bar icon + runs popover** read the companion's state file
(`waiting`, `runs`), which is the companion's aggregate view.

## First-use feedback (c0097 live test)

Answering the open turn should happen **in place, in display mode** — the point
of the pinned open turn (c0096) is that the human resolves it without hunting
through the raw file. Observed in the first real park/resume:

- Checkboxes were already toggleable in display mode (good — keep that as the
  answer gesture for choice questions).
- An open (text) question still needed edit mode to type the answer, which is
  the friction. The open turn's rendering should offer an inline answer slot in
  display mode too, so a whole turn — boxes *and* text — is answerable without
  switching to edit mode.

So c0100's open-turn rendering is not just "prominent + editable" — it is the
**answer surface**: check a box or type into the slot, save, done.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 first-use feedback captured (answer-in-display-mode; text slot)
- 2026-07-19 status → ready (app)
