---
id: i0031
title: Newly create Card has inbox epic
status: done
type: issue
ref: c0088
epic: e07
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T18:09:57
---

## What

Bug (e07 fallout, ref c0088): a card with no epic (a freshly captured card, or
any standalone card in `cards/`) shows **"inbox"** as its epic in the CardDetail
Epic selector. Leftover from the pre-reframe model where a milestone-less card
*was* inbox — the selector renders a stray `<option value="inbox">inbox</option>`
and defaults to it. A no-epic card should show **"No epic"**.

## Acceptance criteria

- [x] A no-epic card's Epic selector shows "No epic" (not "inbox")
- [x] There is no "inbox" option in the epic selector
- [x] An epic-assigned card still shows its epic

## Log

- 2026-07-18 status → ready (app)
- 2026-07-18 fixed (agent): CardDetail's Epic selector dropped the leftover
  `<option value="inbox">inbox</option>` and now derives its value from
  card.epic — a null epic matches the "No epic" option (milestoneId null).
  Reproducing test added. 500 tests + typecheck + lint green.
- 2026-07-18 status → done (app)
