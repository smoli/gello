---
id: i0125
title: Unwrappable text bleeds out of card
status: review
type: issue
created: 2026-08-04
updated: 2026-08-05
status-changed: 2026-08-05T13:26:11
epic: e02
---

![image](../../assets/i0125/image.png)

## What

A card title containing a long unbreakable token — a file path or a backticked
identifier like `.../BehaviorGenerationPipeline.ts`, with no space to wrap at —
overflowed the card's right edge (see the screenshot) instead of wrapping.

## Acceptance criteria

- [x] A long unbreakable token in a card-front title breaks to fit the card
      rather than bleeding past its edge
- [x] The same holds for the card-detail title header (it must not push the
      action buttons aside either)
- [x] Ordinary titles are unaffected — normal words still wrap at spaces

## Notes

- CSS-only. The card title had no wrapping rule, so an over-long token
  (`overflow-wrap: normal`) had nowhere to break and spilled out.
  `overflow-wrap: anywhere` on `.card-title` breaks the token mid-string and —
  unlike `break-word` — also shrinks the element's min-content width, so the
  token can never push the card wider than its column.
- Fixed the detail title (`.card-detail-title h1`) to match, plus `min-width: 0`
  on its `flex: 1` wrapper so a long token wraps instead of shoving the header's
  Report/Edit/Delete buttons off-screen.
- Not unit-tested: the bug and the fix are pure layout (wrapping/overflow),
  which jsdom does not compute — consistent with the repo's other CSS-only
  behaviours. Worth a glance in the running app.

## Log

- 2026-08-04 status → backlog (app)
- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 overflow-wrap: anywhere on the card-front and card-detail titles so
  long unbreakable tokens break instead of bleeding out — CSS-only
- 2026-08-05 status → review (agent)
