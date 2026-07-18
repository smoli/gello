---
id: e07
title: Inbox-Handling
status: backlog
---

## Goal

Rework the inbox from a **folder into a status**. A card's location becomes
purely its epic assignment — `cards/` (unassigned) or `epics/eNN/`
(assigned) — and **`inbox` is the first status/column**. This removes the
`.gello/inbox/` folder, retires the c030 half-state (an inbox card shown in a
non-backlog column), and shrinks the drag model to "drop = status, with an
epic prompt only when leaving inbox unassigned". Moving a card back to inbox
becomes a plain status change.

Design: [[c0087]] (the reframe discussion).

## Definition of done

- `inbox` is a status/column; no `.gello/inbox/` folder; cards live in
  `cards/` or `epics/eNN/` by assignment only.
- Capture writes a new card to `cards/` with `status: inbox`.
- Dragging changes status; a no-epic card leaving inbox prompts for an epic
  (pick / No epic / New epic / cancel); back-to-inbox is a status change.
- Existing boards (this repo + users) migrated; dogfood load test green.
- concept.md / CLAUDE.md updated; the superseded siblings reconciled
  (c0085 stay-in-inbox, c0086 inbox epic tag; i0005/c028/c030 reworked).

## Plan (steps + dependencies)

1. **c0088 — Inbox-as-status data model** (root). Loader + board.yaml;
   everything depends on this.
2. **c0089 — Capture to `cards/` with `status: inbox`** (← c0088).
3. **c0090 — Board: inbox column + drag/picker rework** (← c0088). Drop =
   status; inbox-exit-without-epic prompt; back-to-inbox; retire c030.
4. **c0091 — Migration: `inbox/` → `cards/` + `status: inbox`** (← c0088).
5. **c0092 — Docs: inbox-as-status vocabulary** (← c0088).

Supersedes **c0085** (remove stay-in-inbox) and **c0086** (remove inbox epic
tag) — folded into c0090/c0088; close them when this lands.

## Source

Broken down from the c0087 discussion (inbox as a status, not a folder;
location = epic assignment; drop = status with an inbox-exit epic prompt;
back-to-inbox is a status change; migration of existing boards).
