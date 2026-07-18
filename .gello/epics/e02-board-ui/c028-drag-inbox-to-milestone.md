---
id: c028
title: Drag inbox to milestone
status: done
created: 2026-07-16
updated: 2026-07-16
epic: e02
---

You cannot drag from inbox to backlog, which is fine. How about initiating a drag of an inbox item and the UI changes to columns per milestone

## What

While dragging a card that lives in `.gello/inbox/` and whose status is
`backlog` or `discuss`, an overlay strip of milestone drop zones appears
alongside the normal status columns. Dropping on a milestone zone triages the
card: the file moves into that milestone's folder, its frontmatter status
stays unchanged. Status columns remain drop targets during the same drag
(the c030 flag-to-status gesture keeps working). Cards already in a
milestone never show the strip.

## Acceptance criteria

- [x] Starting a drag on an inbox-folder card with status `backlog` or
      `discuss` shows one drop zone per milestone (labelled with the
      milestone title, folder name as fallback); the strip disappears when
      the drag ends or is cancelled
- [x] Dragging a milestone card, or an inbox card with any other status
      (e.g. `ready`), shows no strip
- [x] Dropping on a milestone zone moves the card file from `.gello/inbox/`
      into that milestone's folder; file content, including status, is
      otherwise unchanged byte-for-byte (milestone field + updated bump +
      asset-link prefixes excepted — identical to dialog triage, see Notes)
- [x] Relative asset links in the moved card are rewritten for the new
      folder depth
- [x] Status columns still accept the drop during the same drag (existing
      status-change behavior unchanged)
- [x] Dropping outside any target cancels with no file change
- [x] With zero milestones, no strip appears
- [x] The move is atomic and the watcher reconciles it without a
      duplicate/ghost card

## Discussion

- **Overlay strip, not full-board morph**: morphing the columns into
  milestones mid-drag would remove status drop targets, breaking the
  inbox→discuss/ready gesture (c030). The strip keeps both target kinds
  live in one drag.
- **Keep status on drop**: milestone assignment and status are independent
  triage axes; the drop only moves the file. (Rejected: normalize to
  `backlog`; rejected: per-status sub-zones inside milestone targets —
  combined status+milestone drop adds complexity nobody asked for.)
- **Scope: inbox only**: milestone→milestone re-assignment is deliberately
  out; separate card if wanted later.
- **Trigger = inbox folder + status `backlog` or `discuss`**: discuss exit
  is triage-to-milestone, so the gesture belongs there too; other flagged
  inbox cards (ready etc.) drag as today.
- **Open**: keyboard-accessible equivalent for milestone assignment (arrow
  keys only cover status today); exact strip placement (above vs. below
  the columns) is an implementation detail.

## Notes

- Drop reuses `triageCard` (c013) verbatim — one triage code path for
  dialog and drag. So the drop also sets the `milestone:` field, bumps
  `updated`, and rewrites asset-link prefixes; status preserved as specced.
  Write-new-then-delete-old and watcher self-echo suppression come along
  for free (criterion 8).
- Strip is an **overlay** pinned over the toolbar + column-header zone
  (absolute within .board) — review feedback: the original in-flow strip
  pushed the whole board down mid-drag, which moved the drop targets while
  aiming. Out-of-flow = zero layout shift. One dashed zone per milestone
  group (generous hit targets); milestone id falls back to the folder's
  `m\d+` prefix for groups without milestone.md.
- App fix: `handleTriage` no longer force-opens the detail — it follows the
  card only if that card's dialog was already open.
- "Dropping outside cancels" = native DnD default (no drop handler → no
  action) + dragEnd clears the strip; covered by the strip-disappears test.
- Open (unchanged from discussion): keyboard-accessible milestone
  assignment.
- 6 new tests (5 Board, 1 App). Suite: 149.

## Log

- 2026-07-16 captured via quick capture, enriched via discuss convention, triaged to m02
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 6 tests (red → green), all gates clean, status → review
- 2026-07-16 review feedback (Stephan): in-flow strip shifts layout — reworked as overlay, status → review
