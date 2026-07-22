---
id: c0121
title: It still stays when moving the mouse up
status: done
ref: c0120
epic: e01
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T08:37:24
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

## Acceptance criteria

- [x] Moving the pointer up a column clears the trigger on the card left behind
- [x] At most one card on the board shows a trigger at any time
- [x] Entering a card clears every other card's trigger on its own, without
      depending on a `mouseleave` from the card being left
- [x] Moving down, leaving sideways, and dragging still clear it (c0120)
- [x] Covered by tests that fail without the fix

## Notes

**Root cause, found by reproducing it rather than reasoning.** Built a
throwaway CDP harness: headless Chrome, the Tauri boundary mocked via
`Page.addScriptToEvaluateOnNewDocument` (`find_board_root` /
`read_board_files`), pointed at the running Vite server, driving real
`Input.dispatchMouseEvent` moves up and down a column of review cards and
reading back which triggers were lit.

In Chrome the c0120 code was already correct in **both** directions — exactly
one card lit, moving up or down. That is the finding: the enter/leave logic is
sound, and WKWebView is simply not delivering the `mouseleave` when the pointer
exits a card upward.

The actual defect was therefore the *shape* of the state, not the handlers.
c0120 gave every card its own boolean, so a dropped `mouseleave` stranded one
lit with nothing able to evict it — matching "stays forever, vanishes when I
move down" precisely (moving down does deliver the leave).

**Fix**: one board-level `hoveredPath` instead of N booleans. Entering a card
overwrites it, so the *enter* alone evicts the previous card and the leave
becomes a bonus rather than a requirement. Two cards can no longer be lit at
once by construction. `onHoverEnd` clears only if the card still owns the
reveal, so a late leave cannot unlight the card now hovered.

Verified both ways: in jsdom (an enter with no preceding leave moves the
reveal — fails before the fix), and in the real browser harness, where
dispatching a bare `mouseover` on another card while one is lit now hands the
reveal over cleanly.

Earlier, ruled out by reading the code:

- **No geometric asymmetry.** Moving up and moving down cross the same
  `0.5rem` column gap. The insert zone between cards is `height: 0` and
  `pointer-events: none`. `.card-front` has no negative margins and nothing
  overlapping a neighbour, so neither direction has an element the other lacks.
- **Not the coarse-pointer fallback.** `@media (hover: none)` would pin every
  trigger visible in both directions; the human sees it clear going down.
- **Not `.card-followup:hover`.** That rule sets colours only, never `opacity`.
- **Not stale CSS `:hover`** any more — after c0120 the reveal does not consult
  `:hover` at all.

That list is what made the static approach a dead end — and why the harness was
worth building. The reveal stayed a hover reveal; the human chose to keep
chasing it rather than drop it, and the evidence made the fix obvious.

Worth knowing for next time: the app *can* be driven headlessly. Chrome over
CDP with `window.__TAURI_INTERNALS__.invoke` stubbed renders the real board
against the dev server, with real pointer input. It is not WKWebView, so it
will not show WebKit-specific delivery bugs — but it proves whether logic is
sound, which is exactly what was needed here. Could become a project skill or
a checked-in harness if this keeps coming up.

## Log

- 2026-07-22 status → in-progress (agent)
- 2026-07-22 asked (agent) / answered (human): keep chasing it — the trigger
  stays forever on the way up and clears when moving down.
- 2026-07-22 fixed (agent): reproduced over CDP in Chrome, where c0120 was
  already correct both ways — so WKWebView drops the upward `mouseleave` and
  the real defect was one boolean per card. Replaced with a single board-level
  `hoveredPath`, so an enter evicts the previous card without needing a leave.
  985 tests green.
- 2026-07-22 status → review (agent)
- 2026-07-22 status → done (app)
