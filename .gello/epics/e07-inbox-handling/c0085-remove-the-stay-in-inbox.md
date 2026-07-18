---
id: c0085
title: remove the stay in inbox
status: ready
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T16:32:54
epic: e07
order: 10
---

In the epic picker on drag there’s a „sta yin inbox“ option. That’s confusing because the card elaves inbox nonetheless. Remove that option

## What

When an epic-less inbox card is dropped on discuss/backlog/ready, the epic
picker (i0005) appears with a dismiss button labelled **"Stay in inbox"**
(or "Move back to …"). It's misleading: dismissing currently calls
`handleMove` to **apply the dropped-on status**, so a backlog idea dropped on
`discuss` becomes a discuss-status inbox card — which renders in the discuss
column (c030), *leaving the inbox column* despite the "Stay in inbox" label.

Fix:

- **Remove the dismiss button** ("Stay in inbox" / "Move back to …") and the
  `fromStatus`/label logic behind it.
- **Dismiss = cancel the whole drop.** Escape or backdrop click makes no
  change: the card keeps its original status and stays in the inbox column;
  nothing is written.
- The picker's real destinations are unchanged: pick an epic (triage +
  status), the existing **No epic** option (→ standalone `cards/` + status),
  or **+ New epic**.

This deliberately removes the c030 "flag-forward on dismiss" gesture (drop a
raw idea on discuss to flag it while keeping it in inbox). That half-state —
inbox folder, non-backlog status — is exactly what confused; it's gone by
design.

## Acceptance criteria

- [ ] The picker no longer shows a "Stay in inbox" / "Move back to …" button
- [ ] Dismissing the picker (Escape or backdrop click) makes no change — the
      card keeps its original status, stays in the inbox column, and no file
      is written
- [ ] The forward options still work: pick an epic (triage + dropped status),
      "No epic" (→ `cards/` + dropped status), "+ New epic"
- [ ] No status is applied on dismiss (c030 flag-forward-on-dismiss removed)
- [ ] Tests that asserted dismiss-applies-status are updated to
      dismiss-cancels

## Discussion

- **"Stay in inbox" was dishonest**: dismiss applied the dropped-on status,
  so the card left the inbox column (c030) despite the label. Removing the
  button and cancelling on dismiss makes backing out mean backing out.
- **Cancel-on-dismiss** (user's call): the intuitive "never mind". It drops
  the c030 flag-forward-on-dismiss behaviour — the confusing half-state is no
  longer produced by this gesture.
- **No new option needed**: the picker already offers "No epic" (→ `cards/`),
  so pick-epic / No-epic / new-epic / cancel covers every destination.
- **Part of e07 (inbox handling)**.
- **Open**: whether the c030 flag-forward *state* (an inbox card shown in a
  non-backlog status column) should remain reachable at all, or be
  reconsidered wholesale in e07 — out of scope for this removal.

## Log

- 2026-07-18 status → discuss (app)
- 2026-07-18 discussed (agent): remove the "Stay in inbox" dismiss button;
  dismiss now cancels the drop (no status applied, card stays in inbox);
  picker keeps epic / No-epic / New-epic. Removes c030 flag-forward-on-dismiss.
- 2026-07-18 status → ready (app)
