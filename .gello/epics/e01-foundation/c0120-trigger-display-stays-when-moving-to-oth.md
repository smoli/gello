---
id: c0120
title: Trigger display stays when moving to other card
status: in-progress
ref: c0118
epic: e01
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T07:05:55
---

When I move the mouse from one card to another the trigger stays. Only when I exit the card to the side, it vanishes

## What

c0118 reveals the follow-up trigger with one CSS rule,
`.card-front:hover .card-followup`. Nothing in JS knows the card is hovered,
so the reveal is only ever as good as the engine's `:hover` bookkeeping — and
this board re-renders under the pointer constantly (companion poll, activity
lines, file-watcher reconcile). WebKit does not re-resolve `:hover` for a
subtree it has just re-rendered until the next pointer event that changes the
hit-test target; sliding straight onto a neighbouring card in the same column
does not always produce one, while leaving sideways does.

Drive the reveal from the card's own hover state instead of a cross-element
CSS selector. That both fixes the stale reveal and makes it testable — c0118
could not assert the behaviour at all, because jsdom applies no stylesheet.

## Acceptance criteria

- [ ] A card's trigger is hidden until that card is hovered
- [ ] Moving the pointer from one card to another hides the first card's
      trigger and shows the second's — no card is left showing a trigger the
      pointer has left
- [ ] Leaving a card in any direction hides its trigger
- [ ] Starting a drag clears the hover reveal (the pointer leaves without a
      mouseleave once the card is being dragged)
- [ ] The trigger keeps its box whether shown or hidden, so revealing it never
      reflows the badge row
- [ ] The trigger is still revealed by keyboard focus, and still only exists on
      `review`/`done` cards
- [ ] The behaviour is covered by tests that fail without the fix

## Log

- 2026-07-22 status → in-progress (agent)
