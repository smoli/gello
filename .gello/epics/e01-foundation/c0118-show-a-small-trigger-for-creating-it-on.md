---
id: c0118
title: Show a small trigger for creating it on the card front
status: done
ref: c0115
epic: e01
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T08:37:26
---

Reduces clicks

## What

A follow-up (c0115) currently costs three clicks from the board: open the card,
press **Follow up**, type. Put the trigger on the card front so reviewing work
and queueing more work happen in the same place.

## Acceptance criteria

- [x] A card front whose status is `review` or `done` shows a small follow-up
      trigger; a card in any other status shows none
- [x] Clicking the trigger opens the follow-up draft straight from the board,
      without opening the card detail first
- [x] The trigger's click does not fall through to the card (the detail view
      does not open behind the draft)
- [x] Submitting that draft creates exactly what c0115 creates — a task with
      `ref` to the card, the card's epic, landing in `ready`
- [x] The draft still states that the card lands in `ready`, so the click that
      can start an agent run stays legible (c0115)
- [x] The trigger is keyboard reachable and carries an accessible name naming
      the card it follows up on
- [~] The trigger stays quiet: it does not compete with the card's title,
      badges or tags — implemented, but verified by code/CSS review only, not
      on screen (see Notes)

## Notes

- The card arrived with no acceptance criteria (it was itself dashed off
  through the c0115 follow-up flow). The criteria above are my reading of
  "a small trigger for creating it on the card front"; the design calls behind
  them are in Discussion.
- `onFollowUpCard` threads `Board → Column → CardFront`. Absent → no trigger
  renders at all, so the board stays inert for any host that does not wire it.
- The trigger opens the **draft**, it never creates a card outright. That keeps
  c0115's rule intact: the click that can start an agent run says so first.
- The click calls `stopPropagation` — the whole card front is a click target
  (and a drag handle), so without it the detail view would open behind the
  draft.
- **Not verified on screen.** `pnpm tauri dev` could not start: port 1420 was
  held by a Vite dev server that had been up ~23h, i.e. the human's own running
  instance. Killing it or screenshotting their desktop was not mine to do, and
  there is no browser automation in the repo (no Playwright, no chromium-cli)
  and no Tauri-mocked harness to drive the Vite build headlessly. Behaviour is
  covered by tests; the resting/hover appearance is code review only. Worth a
  human glance — the running instance already has it via HMR.

## Discussion

- **Gated to `review`/`done`**, matching c0115's detail-view action. A
  follow-up is by definition about finished work, and a "+" on every card in
  every column would be noise.
- **Hover/focus reveal over always-visible.** The card says *small*, and a
  column of finished cards each showing a persistent button reads as clutter.
  The button keeps its box at all times (`opacity`, not `display`), so
  revealing it never reflows the badge row. `@media (hover: none)` keeps it
  visible where there is no hover to trigger it.
- **Placed in the badge row**, sized like the existing needs-input badge, so it
  lands in the row already meant for small per-card affordances instead of
  adding a new region.
- **Rejected: creating the follow-up straight from the "+"** with a generated
  title. Fewest clicks, but it would fire an agent run with no title and no
  warning — exactly what c0115 designed against.

## Log

- 2026-07-22 status → in-progress (agent)
- 2026-07-22 implemented (agent): onFollowUpCard threaded Board → Column →
  CardFront, hover/focus-revealed "+" in the badge row on review/done cards,
  opening the c0115 draft. 979 tests green. Not screenshot-verified — the dev
  port was held by the human's own instance.
- 2026-07-22 status → review (agent)
- 2026-07-22 status → done (app)
