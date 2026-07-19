---
id: c0100
title: App — title-bar runner indicator + needs-input badge
status: backlog
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-19
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

- [ ] The app watches the companion state file and shows a title-bar icon
      reflecting runner state (idle / running / waiting / attached / attention)
- [ ] Clicking the icon opens a popover listing active runs with their phase
- [ ] No indicator when there's no companion state file (companion not
      running)
- [ ] Card fronts show a "needs input" badge when the card is parked awaiting
      an answer (c0096 marker)
- [ ] Sits beside the c0083 dirty-worktree indicator without layout clashes

## Notes

Same title-bar surface and file-watch pattern as the c0083 dirty dot — keep
them visually consistent.

## Log

- 2026-07-19 created from the e08 companion breakdown
