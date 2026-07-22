---
id: c0120
title: Trigger display stays when moving to other card
status: done
ref: c0118
epic: e01
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T08:08:44
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

- [x] A card's trigger is hidden until that card is hovered
- [x] Moving the pointer from one card to another hides the first card's
      trigger and shows the second's — no card is left showing a trigger the
      pointer has left
- [x] Leaving a card in any direction hides its trigger
- [x] Starting a drag clears the hover reveal (the pointer leaves without a
      mouseleave once the card is being dragged)
- [x] The trigger keeps its box whether shown or hidden, so revealing it never
      reflows the badge row
- [x] The trigger is still revealed by keyboard focus, and still only exists on
      `review`/`done` cards
- [x] The behaviour is covered by tests that fail without the fix

## Notes

- `CardFront` now owns a `hovered` flag set from `onMouseEnter`/`onMouseLeave`
  and cleared on `dragStart`; the button carries `card-followup-visible`, and
  the CSS reveal keys off that class instead of `.card-front:hover`. State is
  local to the card, so a hover re-renders one card front, not the column.
- Still `opacity`, never `display` — the button keeps its box, so the badge row
  does not reflow when it appears. `:focus-visible` and the `@media
  (hover: none)` fallback are untouched.
- **Why it stuck**: nothing in JS knew a card was hovered, so the reveal was
  only as reliable as the engine's `:hover` bookkeeping. This board re-renders
  under the pointer constantly (2s companion poll, activity lines, watcher
  reconcile), and WebKit does not re-resolve `:hover` for a subtree it has just
  re-rendered until the hit-test target changes again. Sliding onto the
  neighbouring card in the same column often did not produce that; leaving
  sideways did — which is exactly the reported shape.
- **Confidence**: the mechanism above is reasoned from the code, not observed
  in a debugger — the bug needs a real WebView and there is no browser
  automation in the repo. What is verified is that the reveal no longer depends
  on `:hover` at all, and that enter/leave now drive it. If the trigger still
  lingers in the running app, the cause is elsewhere and this card should
  reopen.
- The fix also closes c0118's testing gap: the reveal was pure CSS, which jsdom
  never applies, so c0118 could assert nothing about it. Four tests now cover
  it; removing `onMouseLeave` fails two of them (checked by mutation).

## Log

- 2026-07-22 status → in-progress (agent)
- 2026-07-22 fixed (agent): CardFront owns the hover flag (enter/leave, cleared
  on dragStart); CSS reveals on `.card-followup-visible` instead of
  `.card-front:hover`. 4 tests added, 983 green. Mechanism reasoned, not
  observed in a WebView — see Notes.
- 2026-07-22 status → review (agent)
- 2026-07-22 status → done (app)
