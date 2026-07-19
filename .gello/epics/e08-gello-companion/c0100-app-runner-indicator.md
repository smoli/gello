---
id: c0100
title: App — title-bar runner indicator + needs-input badge
status: review
epic: e08
depends: [c0093]
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T21:05:00
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

So the open turn is not just "prominent + editable" — it is the **answer
surface**: check a box or type into the slot, save, done. **This rendering is
split into [[c0101]]** ("More distinctive Question rendering", in discuss) —
c0100 delivers the title-bar indicator + the card-front badge; c0101 owns the
in-detail open-turn answer surface.

## Implementation

- [src/lib/companion.ts](../../../src/lib/companion.ts): `parseCompanionState`
  (defensive JSON → `CompanionState | null`) + `readCompanionState(root)` via
  the generic `read_file` command. Absent/garbage → null. 8 tests.
- [src/components/TitleBar.tsx](../../../src/components/TitleBar.tsx): a runner
  button (glyph + a11y label per status) beside the dirty dot; click → a
  popover of active runs (cardId + phase). Rendered only when `runner` is
  non-null. Tests in TitleBar.test.tsx.
- [src/components/Board.tsx](../../../src/components/Board.tsx): a `card-needs-
  input` badge on the card front when `card.awaiting === "input"`. The `Card`
  gains an `awaiting` field ([src/lib/cards.ts](../../../src/lib/cards.ts)).
- [src/App.tsx](../../../src/App.tsx): reads companion state on load, on each
  board reconcile, and on a 2s poll; passes it to `TitleBar`.
- **No Rust change**: the app's file watcher filters out `.json`, and the
  `.companion/` dir appears/vanishes as the companion starts/stops. A light
  poll handles that lifecycle without a watcher that would have to track the
  dir coming and going. A dedicated `watch_companion_state` command (mirroring
  `watch_git_head`) could replace the poll later if latency matters.
- Not browser-verifiable (the board needs Tauri FS to load); covered by the
  component/integration tests and the c0097 live run that wrote real state.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 first-use feedback captured (answer-in-display-mode; text slot)
- 2026-07-19 status → ready (app)
- 2026-07-19 status → in-progress; built the title-bar runner indicator (reads
  `.companion/state.json`, click → runs popover) + the card-front needs-input
  badge (`awaiting: input` marker). Answer-surface rendering split to
  [[c0101]]. Full suite 580 green, typecheck + lint clean. status → review.
