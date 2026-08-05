---
id: c0147
title: Add a stop button to the card front
status: review
ref: c0119
epic: e08
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T23:54:29
---

reuse the css mechanics already available for the follow up buttons in the review/done queue to only show the stop button when the mouse hovers the card

## Notes

- 2026-08-05 (agent) A card with a **live run** (running or parked) now shows a
  small ✕ stop in the card-front meta row. It reuses the follow-up trigger's
  reveal exactly: `.card-stop` is `visibility: hidden`, shown by
  `.card-front:hover .card-stop` (the CSS mechanic the card asked to reuse) and
  by c0121's pointer-tracked `.card-stop-revealed` (the same `revealFollowUp`
  prop the follow-up buttons carry, so the reveal stays correct in WKWebView
  where `:hover` is unreliable). Styled destructive (danger red on hover), since
  it ends live work.
- **Wired to the existing stop path**, not a new one: the button calls the
  c0119 `onStopRun` → `handleStopRun` → `requestStopRun`, and `stopPropagation`
  keeps the click from opening the card. No confirm dialog — like the c0119
  popover stop, a click here is explicit intent (the confirm is only for the
  destructive *drag*).
- **Gate**: a new `hasLiveRun(state, cardId)` (running or `waiting-for-input`);
  a done/error/aborted run has nothing to stop, so no button. Threaded
  `onStopRun` through Board → Column → CardFront alongside c0141's
  `onRestartCard`.
- Verified: 1351 tests (six new Board tests — offered on a live/parked run,
  stops without opening the card, hidden with no run or no handler, reveal class
  toggles on hover), typecheck, lint, and a production build with the reveal
  CSS confirmed present after minification.

## Log

- 2026-08-05 status → in-progress (agent)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 (agent) added a hover-revealed ✕ stop to the card front for a card
  with a live run, reusing the follow-up trigger's reveal mechanic and the
  c0119 stop path. All tests, typecheck, lint and a build green.
- 2026-08-05 status → review (agent)
