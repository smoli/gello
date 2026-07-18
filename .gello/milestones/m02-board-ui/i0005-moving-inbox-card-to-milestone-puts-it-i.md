---
id: i0005
title: Moving inbox card to milestone puts it in backlog
status: done
type: issue
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T11:54:37
milestone: m02
---

That’s confusing. Most of the time I want to move it to discussion next.

Maybe we need another way to assign the milestone.

## What

The gesture is inverted from today's milestone-strip flow: instead of
"drop on a milestone, then it's stuck in backlog", the user drops the
inbox card on the **status** they want next (usually `discuss`), and
because the card has no milestone yet, an inline **milestone picker**
pops up so the milestone can be assigned in the same motion. Status comes
from the column you dropped on; the milestone is what gets prompted.

Two paths:

1. **Status-drop → inline milestone picker.** Dragging a milestone-less
   inbox card onto the `discuss`, `backlog`, or `ready` column shows an
   inline milestone picker. Choosing a milestone triages the card: file
   moves into that milestone folder with the dropped-on status. The pick
   is **optional** — dismissing still applies the new status but leaves
   the card in the inbox folder (today's c030 behavior), badged "inbox".
   Dropping on `in-progress` / `review` / `done` does not prompt (they
   aren't inbox-triage destinations) — unchanged.
2. **Milestone picker in the card detail.** A deliberate, keyboard-
   friendly path: a milestone selector (plus status) in the detail view,
   for assigning or reassigning without a drag. Works for any card.

## Acceptance criteria

- [x] Dropping a milestone-less inbox card on `discuss`/`backlog`/`ready`
      shows an inline milestone picker listing the board's milestones
- [x] Choosing a milestone commits atomically: file moves to that
      milestone folder, `milestone` + the dropped-on `status` set, relative
      asset links rewritten, `status-changed` stamped (c056)
- [x] Dismissing the picker (Escape / click-away) still applies the new
      status but leaves the card in the inbox folder — no milestone, no
      move (preserves c030)
- [x] Dropping on `in-progress`/`review`/`done` applies the status with no
      milestone prompt (unchanged)
- [x] An inbox card that already has a milestone, or a milestone card, does
      not trigger the picker on a status drop
- [x] Card detail offers a milestone selector (+ status); assigning a
      milestone to an inbox card triages it (same move + link rewrite),
      settable in the same edit
- [x] Reassigning milestone/status from the detail on an already-triaged
      card works without duplicating or losing the file

## Discussion

- **Status-first, milestone-prompted**: the natural motion is "move this to
  discussion" — the user picks the destination status by column, and the
  app fills the one missing fact (milestone) inline. This is the corrected
  reading of the idea (an earlier draft had it backwards: milestone-first,
  status-prompted).
- **Milestone pick is optional**: dismissing keeps the current c030 escape
  hatch — flag an inbox card to `discuss` without committing to a milestone
  yet. Non-blocking; the card just stays in the inbox with its new status.
- **Trigger = discuss/backlog/ready only**: these are the real triage
  destinations; in-progress/review/done aren't where raw ideas land, so
  they stay quiet.
- **Complements the c028 milestone strip, doesn't replace it**: the strip
  assigns a milestone directly (keeping status); this adds a status-first
  path. With this in place the strip's "keeps backlog" is no longer
  surprising — you use the status-drop when you care about the status.
  (Whoever implements should decide whether both paths stay or the strip
  retires; not resolved here.)
- **Open**: should the detail milestone picker also move a card *back* to
  the inbox (milestone → none); picker presentation (popover at the drop
  point vs. a small overlay); does the picker offer "no milestone / stay in
  inbox" as an explicit option rather than only dismiss.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): status-first drop with an inline milestone
  picker (optional; discuss/backlog/ready only) + milestone/status picker
  in card detail. Corrected from an earlier milestone-first framing.
- 2026-07-17 status → backlog (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): status-drop inline milestone picker
  (discuss/backlog/ready; dismiss = status-only, stay in inbox) via
  triageCard's new status param + Board routing + MilestonePicker overlay;
  detail milestone select now reassigns already-triaged cards too.
- 2026-07-17 refined (agent): retired the c028 milestone strip (the
  status-drop picker replaces it). Picker dismiss is origin-aware — a
  discuss-origin card returns to discuss ("Move back to discuss"); only a
  raw backlog idea keeps the c030 flag-it-forward dismiss ("Stay in inbox").
- 2026-07-17 status → done (app)
