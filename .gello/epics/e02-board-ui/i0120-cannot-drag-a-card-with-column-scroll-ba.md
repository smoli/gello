---
id: i0120
title: Cannot drag a card with column scroll bar
status: in-progress
type: issue
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T09:36:10
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

- [ ] `.card-front` declares `user-select: none`, prefixed and unprefixed
- [ ] `.card-front` declares `-webkit-user-drag: element`
- [ ] A test fails if those declarations are removed
- [ ] No other element depends on the `[draggable=true]` UA rule

## Log

- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
