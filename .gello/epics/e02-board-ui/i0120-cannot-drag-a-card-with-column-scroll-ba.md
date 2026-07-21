---
id: i0120
title: Cannot drag a card with column scroll bar
status: review
type: issue
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T09:47:20
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

## Acceptance criteria

- [x] `.card-front` declares `user-select: none`, prefixed and unprefixed
- [x] `.card-front` declares `-webkit-user-drag: element`
- [x] A test fails if those declarations are removed
- [x] No other element depends on the `[draggable=true]` UA rule

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
