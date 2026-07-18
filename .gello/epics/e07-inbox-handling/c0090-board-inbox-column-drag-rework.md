---
id: c0090
title: Board — inbox column + drag/picker rework
status: review
epic: e07
depends: [c0088]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T17:58:03
order: 18.125
---

## What

Rework the board drag model around inbox-as-status.

- The inbox column renders as an ordinary status column; retire the special
  inbox-column rendering and the c030 "inbox card in a non-backlog column"
  half-state (no longer possible).
- **Drop = status change.** Dragging a card between columns only sets its
  status — including into the inbox column (back-to-inbox is a plain status
  change, no file move, no epic change).
- **Inbox-exit prompt.** Dragging a **no-epic** card *out of* the inbox
  column prompts for an epic (reworked i0005/c028 picker: pick epic / No
  epic / + New epic / cancel). Cancel keeps it in inbox; picking an epic
  moves the file into the epic folder and applies the dropped-on status.

Supersedes [[c0085]] (dismiss = cancel is now the model) and folds in the
c030 removal.

## Acceptance criteria

- [x] Inbox is a normal column; no separate inbox-column rendering or
      inbox/c030 badge
- [x] Dragging between columns changes only status; dragging onto inbox sets
      `status: inbox` (no file move / epic change)
- [x] Dragging a no-epic card out of inbox prompts for an epic; cancel keeps
      it in inbox; picking an epic moves the file + applies status
- [x] A card that already has an epic leaving inbox just changes status (no
      prompt)
- [x] No "Stay in inbox" dismiss button; dismiss cancels (c0085 folded in)

## Log

- 2026-07-18 created from the e07 inbox reframe (c0087)
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): part of the e07 inbox-as-status reframe, landed as one coherent pass; full suite (500) + Rust (41) + typecheck + lint green.
