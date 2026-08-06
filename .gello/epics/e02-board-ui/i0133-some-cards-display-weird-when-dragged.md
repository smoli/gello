---
id: i0133
title: Some cards display weird when dragged
status: done
type: issue
created: 2026-08-05
updated: 2026-08-06
status-changed: 2026-08-06T05:48:37
epic: e02
---

![image](../../assets/i0133/image.png)

Might be cards with thumbnails only. Looks as if I would drag the card and all columns dashed lines and all ready cards. The drag result itself is fine

## What

While a card is dragged, several cards render **doubled** — painted twice,
offset (see the screenshot: "Swimlanes by tag", the two Git-integration issues,
the inbox c0143 cards). The dashed column outlines are the intended drop-lane
feedback (c054); the doubling is the bug. The drop itself works.

## Acceptance criteria

- [x] Cards no longer render doubled/ghosted while a drag is in flight
- [x] Only the blur is affected, and only during the drag — the columns keep
      their translucent fill and the blur returns on drop
- [x] Boards without a background image are unaffected

## Notes

- Not thumbnails (the guess): the doubled cards carry none. The common factor is
  a **board background** — the screenshot has one, and `backdrop-filter:
  blur(10px)` on `.board-with-bg .column` is the only background-conditional
  effect. WebKit leaves a ghosted copy of a blurred backdrop while a native drag
  is in flight, so text over it renders doubled; a plain board (no
  backdrop-filter) never shows it.
- Fix: `.board-with-bg.board-dragging .column { backdrop-filter: none }` — drop
  the blur for the duration of the drag only. Removing the filter removes the
  ghosting source outright; the translucent column fill stays, so the only
  visible change is a momentarily sharper background behind the columns while
  dragging, and the blur returns the instant the drag ends.
- CSS-only, so not verifiable in jsdom (no compositing) — like i0125/i0123. The
  one test added guards the fix's *precondition*: that `board-with-bg` and
  `board-dragging` land on the same element during a drag, so the selector keeps
  matching if the class wiring ever changes. **Worth a real-app check** on the
  WebKit build, since the visual behaviour can't be exercised headless.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-06 status → in-progress (agent)
- 2026-08-06 status → ready (app)
- 2026-08-06 status → in-progress (app)
- 2026-08-06 root cause is backdrop-filter ghosting during drag (background
  boards only); drop the column blur while dragging — CSS fix + precondition test
- 2026-08-06 status → review (agent)
- 2026-08-06 status → done (app)
