---
id: i0120
title: Cannot drag a card with column scroll bar
status: done
type: issue
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T12:22:49
epic: e02
---

If the column has a scrollbar, I cannot drag the card. Instead, the card text is selected

## What

Card fronts never declared `user-select`. The only thing keeping their text
unselectable was the UA stylesheet rule Blink ships for draggable elements:

```css
[draggable=true] { -webkit-user-drag: element; -webkit-user-select: none; }
```

Chromium has that rule; WebKit does not. The app runs in WKWebView on macOS, so
in the shipped app the card title is selectable — a mousedown on it starts a
text selection and the drag never begins. Confirmed in the browser: a
`.card-front` computes `user-select: none` only when `draggable` is set, and a
grep of the stylesheets shows gello declares `user-select` nowhere.

That is also why nothing caught it. jsdom applies no UA drag rules and does no
layout, and every browser-based check runs on Chromium, where the UA rule
papers over the gap.

The scrollbar is probably correlation, not cause: a column with a scrollbar is
a full column, so the pointer lands on title text rather than on the empty
padding where there is nothing to select. Grabbing a card by its padding works
in either column.

Fix: declare the behaviour on `.card-front` instead of inheriting it from
whichever engine is underneath.

## The actual cause

The above was real but was masking this, which is what the card title names.

`.insert-zone` grows to a 28px hit area during a drag and cancels it with
`margin: -14px 0`, so the column's height is meant to be unchanged (i0002 /
i0004). That only holds if the 28px survives. The zone is a flex item in
`.column-cards`, and a flex item shrinks by default — so once the column
overflows, which is exactly when it shows a scrollbar, the height is
compressed while the margins stay fixed.

Measured in a browser, column scrolled to 200:

- the zone's 28px was used at **5.4px**, so each of the 17 zones netted −22.6px
- `scrollHeight` collapsed **1239 → 871**, and `scrollTop` was clamped to 16
- every card jumped: **+161px at the top, −178px at the bottom**

WebKit cancels a drag whose source moves under the pointer — the codebase
already knows this (see the i0006 note about unmounting a node next to the
source). Chromium tolerates it, which is why no browser check caught it. Cards
near the crossover point of that shift barely move, so they still drag; the
further from it, the further they jump, which is the boundary that moves with
window height.

With `flex-shrink: 0` every card shifts 0px and `scrollTop` does not move, at
every scroll position.

## Acceptance criteria

- [x] `.card-front` declares `user-select: none`, prefixed and unprefixed
- [x] `.card-front` declares `-webkit-user-drag: element`
- [x] A test fails if those declarations are removed
- [x] No other element depends on the `[draggable=true]` UA rule
- [x] A drag starting in an overflowing column shifts no card and does not
      move `scrollTop`
- [x] The zone's drag-time height cannot be compressed by flex shrink

## Log

- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 implemented (agent): declared `-webkit-user-select`/`user-select:
  none` and `-webkit-user-drag: element` on `.card-front`. Guarded by
  card-drag.test.ts, which reads Board.css — jsdom would pass either way, so a
  rendered assertion could not catch this. Verified the test fails with the CSS
  stashed. `.card-front` is the only `draggable` element in the app.
  828 tests green, typecheck and lint clean.
- 2026-07-21 NOT verified in WKWebView: the browser pane is Chromium, where the
  drag worked before the fix too. The engine-level confirmation is that gello's
  own stylesheet now carries the declarations rather than relying on the UA
  rule. Worth one drag in the running app from a scrolling column.
- 2026-07-21 status → review (agent)
- 2026-07-21 reopened (agent): the user-select fix was real but was masking the
  actual cause. Root cause found and measured — see Notes.
- 2026-07-21 fixed (agent): `flex-shrink: 0` on `.board-dragging .insert-zone`.
  Guarded by two tests reading Board.css — one asserts the height/margin
  arithmetic still cancels, one that the height is pinned, since the
  cancellation is meaningless without it. Verified in a browser at four scroll
  positions: max card shift 0px, scrollTop jump 0. 830 tests green.
- 2026-07-21 status → review (agent)
- 2026-07-21 status → done (app)
