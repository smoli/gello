---
id: c0121
title: It still stays when moving the mouse up
status: in-progress
ref: c0120
epic: e01
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T07:11:55
---

I'd rather not ship a third guess at this. c0120 was already a fix reasoned from the code that didn't hold, and I can't observe the real behaviour from here: no browser automation in the repo, `pnpm tauri dev` can't start (port 1420 is your own dev server, up ~23h), and jsdom has no layout or real pointer, so this class of bug can't be reproduced in the suite. Reading the code, I ruled out the things that would explain it — there's no geometric asymmetry between moving up and moving down (same 8px gap, the insert zone between cards is height-0 and `pointer-events: none`), it isn't the coarse-pointer fallback, and after c0120 the reveal doesn't consult CSS `:hover` at all.

So: how do you want to proceed?

- [ ] **Drop the hover reveal — make the trigger always visible but quiet** (my recommendation). A small, low-contrast `+` that's simply always there. There's no hover state left to get stranded, so this whole bug class disappears, and it still meets c0118's "small, doesn't compete with the title/badges/tags". Costs a little board calm on columns full of finished cards.
- [ ] **Reveal per column instead of per card** — any card in the column the pointer is in shows its trigger. One hover region instead of N, so moving between cards never hands state over. Still a hover reveal, so still some risk.
- [x] **Keep chasing it** — then I need one detail from you, since I can't see it: when it stays on the way up, does it stay *forever* until you move down again, or does it clear after a second / after you click somewhere? And does it stay on the card you left, or does the *whole column* end up showing triggers?
- [ ] Something else (say what)

It stays forever and vanishes when I move down

It vanishes when going down the column

## What

Third report on the same affordance. c0118 revealed the trigger with
`.card-front:hover`; c0120 moved the reveal onto React state driven by
mouseenter/mouseleave. Down the column now clears correctly, up does not.

## Notes

What I ruled out by reading the code:

- **No geometric asymmetry.** Moving up and moving down cross the same
  `0.5rem` column gap. The insert zone between cards is `height: 0` and
  `pointer-events: none`. `.card-front` has no negative margins and nothing
  overlapping a neighbour, so neither direction has an element the other lacks.
- **Not the coarse-pointer fallback.** `@media (hover: none)` would pin every
  trigger visible in both directions; the human sees it clear going down.
- **Not `.card-followup:hover`.** That rule sets colours only, never `opacity`.
- **Not stale CSS `:hover`** any more — after c0120 the reveal does not consult
  `:hover` at all.

What I cannot do here: observe it. There is no browser automation in the repo
(no Playwright, no chromium-cli), `pnpm tauri dev` cannot start because port
1420 is held by the human's own long-running dev server, and jsdom has no
layout, no stylesheets and no real pointer, so this class of bug is not
reproducible in the test suite. c0120 was already one fix reasoned from the
code that did not hold; a third guess is not worth shipping.

Two failures on a hover-reveal affordance also raises the question of whether
the reveal should exist at all — an always-visible but quiet trigger has no
hover state to strand, and still satisfies c0118's "small, does not compete
with the title/badges/tags".

## Log

- 2026-07-22 status → in-progress (agent)
