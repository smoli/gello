---
id: c0087
title: Inbox is a status, not a folder
status: inbox
created: 2026-07-18
updated: 2026-07-20
status-changed: 2026-07-20T17:49:51
---

Cards could be moved out of inbox by accident. Allow to move cards back to inbox from ready, backlog and discuss

## What

Rework the inbox: **inbox becomes a status (a column), not a folder.** Today
`.gello/inbox/` is a folder for unprocessed cards and triage *moves files out
of it* — the root of the confusion in c0085/c0086 and the c030 half-state.
Simplify by decoupling the two axes:

- **Location = epic assignment only.** A card lives in `cards/` (no epic) or
  `epics/eNN/` (assigned). Nothing else decides its folder.
- **`inbox` is just the first status/column.** The `.gello/inbox/` folder is
  removed entirely.

Flows under the new model:

- **Capture** writes a new card to `cards/` with `status: inbox`, no epic.
- **Assignment** moves the file `cards/ ↔ epics/eNN/`; it's independent of
  status (a card can be `status: inbox` in either location).
- **Leaving inbox** — dragging a card out of the inbox column changes its
  status. If it has **no epic**, prompt for one (the existing picker: pick
  epic / No epic / + New epic / cancel) — the single moment assignment is
  nudged, when you start processing an idea. Cancel = stays inbox.
- **Back to inbox** — dragging a card (from ready/backlog/discuss) onto the
  inbox column sets `status: inbox`: no file move, no epic change. (The
  original ask — now trivial.)
- **Migration** — existing `.gello/inbox/*.md` move to `.gello/cards/` with
  `status: inbox`; asset links unchanged (both are depth 1).

This removes the inbox-folder specialness, retires the c030 half-state (an
inbox card is now simply a card in the inbox column), and shrinks the drag
model to "drop = status, with one epic prompt on inbox-exit".

## Acceptance criteria

- [ ] `inbox` is a status/column (first in `board.yaml`); the loader has no
      special inbox-*folder* handling
- [ ] No `.gello/inbox/` folder — cards live in `cards/` (no epic) or
      `epics/eNN/` (assigned), by assignment only
- [ ] Capture writes a new card to `cards/` with `status: inbox`
- [ ] Dragging a card between columns changes only its status (including
      into/out of the inbox column)
- [ ] Dragging a **no-epic** card out of the inbox column prompts for an epic
      (pick / No epic / New epic / cancel); cancel keeps it in inbox; picking
      an epic moves the file into that epic's folder
- [ ] Dragging a card onto the inbox column (from ready/backlog/discuss) sets
      `status: inbox` with no file move and no epic change
- [ ] Migration: existing inbox/ cards move to `cards/` + `status: inbox`
      (this repo's board and user boards); asset links intact; dogfood green
- [ ] concept.md / CLAUDE.md updated: inbox is a status; location = assignment

## Discussion

- **Inbox as status, not folder** (user's call): location tracks assignment
  (`cards/` vs `epics/`), status tracks workflow. Decoupling them deletes the
  inbox-folder specialness and the confusing half-states (c030, c0085's
  "stay in inbox").
- **Drag = status; epic prompt only on inbox-exit-without-epic**: keeps the
  real value of i0005/c028 (assign when you start processing) but narrows it
  to one transition instead of every drop. Dismiss = stay inbox, consistent
  with c0085.
- **Back-to-inbox falls out for free**: it's just a status change, no move —
  the card's original ask needs no special code.
- **Reworks the sibling cards**: supersedes [[c0085]] (stay-in-inbox) and
  [[c0086]] (remove inbox epic tag), reframes i0005/c028 (drop-triggers-picker
  → inbox-exit prompt), and retires c030 (inbox card shown in a non-backlog
  column — no longer possible).
- **Epic-sized**: schema/loader, capture, drag/picker, migration, docs.
  Recommend making this the **spine of e07** and planning it into child cards
  (gello-plan) rather than one card.
- **Open**: an `inbox`-status card *assigned* to an epic lives in `epics/eNN/`
  and shows in the inbox column labelled with its epic — confirm that
  "assigned but still inbox" state is wanted (vs. assignment implying it
  leaves inbox).

## Log

- 2026-07-18 status → discuss (app)
- 2026-07-18 discussed (agent): reframed from "move back to inbox" to **inbox
  as a status, not a folder** — location = epic assignment (cards/ or
  epics/), inbox is the first column, `.gello/inbox/` removed. Drop = status;
  epic prompt only when leaving inbox with no epic. Epic-sized; supersedes
  c0085/c0086, reworks i0005/c028/c030. Retitled.
- 2026-07-18 planned into e07 (agent): this reframe is now e07's goal, broken
  into c0088–c0092 (c0088 root). This card is the design record; close when
  e07 lands.
- 2026-07-20 status → inbox (app)
