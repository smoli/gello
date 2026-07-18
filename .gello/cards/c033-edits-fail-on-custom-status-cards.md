---
id: c033
title: Edits fail on cards with custom-column statuses
status: done
tags: [bug, core]
created: 2026-07-16
updated: 2026-07-16
---

## What

Bug (dogfooding, reported by Stephan with screenshot): editing a card in
`discuss` shows "edit produced an invalid card: unknown status \"discuss\"
(allowed: backlog, ready, in-progress, review, done)".

Root cause: `saveCardBody` and `saveCardEdit` call `replaceCardBody` without
threading the loaded board config, so the internal reparse validates against
DEFAULT_BOARD_CONFIG — which lacks custom columns like `discuss`. The write
is correctly blocked (guardrail works), but the edit is impossible.

## Acceptance criteria

- [x] Body edit and checkbox toggle succeed on a card whose status is a
      custom column (e.g. discuss)
- [x] All board-actions thread the loaded config; no code path validates
      an edit against DEFAULT_BOARD_CONFIG implicitly

## Notes

- `saveCardBody` gained a required config param; `saveCardEdit` now passes
  config to `replaceCardBody`; App's checkbox-toggle handler passes
  `board.model.config`. Every board-actions function now takes the loaded
  config explicitly.
- Residual risk noted: cards.ts low-level functions still *default* to
  DEFAULT_BOARD_CONFIG for convenience (tests rely on it). The rule is:
  board-actions — the layer that owns the live config — must never rely on
  that default. Enforced by review, not compiler, for now.
- Reproducing tests hit the exact production error (unknown status
  "discuss") before the fix.

## Log

- 2026-07-16 reported (screenshot), picked up immediately (agent)
- 2026-07-16 2 reproducing tests red → config threaded → 155/155 green, status → review
