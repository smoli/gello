---
id: c0113
title: More activity ui for glimpse
status: discuss
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T12:27:50
epic: e08
---

## What

The c0109 activity line on a running card front is static text. Because the
line only changes when the *tool* changes (≈1s companion throttle + 2s app
poll), it can sit unchanged for a while — so a working agent looks
indistinguishable from a frozen one.

Give the live line a **left→right highlight sweep** (the Claude Desktop
treatment): a soft band travelling across the text, looping. Card fronts only —
the surface this card is about.

**Motion means live.** c0109 already renders a stale line dimmed and italic
(`.card-activity-stale`, once the state file ages past `STALE_MS`). The sweep
runs **only while the line is live**; a stale line freezes. Otherwise a dead
companion's last line would keep pretending to work, which is worse than the
static line we have now. This reuses the existing flag — no new state.

**Reduced motion is a hard requirement**: `prefers-reduced-motion: reduce`
turns the sweep off and leaves exactly today's static line.

## Acceptance criteria

- [ ] A live activity line on a card front shows a looping left→right highlight
      sweep
- [ ] A stale activity line does **not** animate — it keeps today's dim+italic
      treatment
- [ ] `prefers-reduced-motion: reduce` disables the sweep, leaving the current
      static line
- [ ] The sweep reads correctly in light *and* dark themes (colours derived
      from `CanvasText`, not hard-coded)
- [ ] The line keeps its single-line truncation with ellipsis
- [ ] Nothing animates when there is no activity (no companion, or the card
      isn't running)
- [ ] Which treatment applies (animated / stale / none) is driven by the
      activity's live-vs-stale state and is unit-testable, separate from the CSS

## Discussion

- **Sweep only** (human's call): rejected pairing it with a client-side ticking
  elapsed time (would add information *and* motion, and would expose a stalled
  run — but this card is about the visual feel); also rejected ticking-only and
  a pulsing dot beside static text.
- **Card fronts only** (human's call): rejected extending the treatment to the
  c0100 title-bar runner glyph (equally static today) and to the card detail
  view, which has no activity line yet — that would be new surface, not polish.
- **The animation is semantic, not decorative**: it encodes liveness by
  reusing c0109's existing `stale` flag, so motion is information rather than
  ornament.
- **Contrast is easier here than it was for i0110**: `.card-front` has an
  opaque `Canvas` background, so unlike the toolbar tag chips this text never
  sits directly on the board photo. Colours still have to be theme-derived
  rather than fixed.
- **Open**: `background-clip: text` (the usual gradient-sweep technique)
  interacts awkwardly with `text-overflow: ellipsis` — the ellipsis may not
  pick up the gradient cleanly, so a fallback may be needed; sweep period and
  intensity (subtle enough not to pull the eye across a board of cards);
  whether the animation should pause when the window is unfocused, to avoid
  burning battery on a background board.

## Log

- 2026-07-21 status → discuss (app)
- 2026-07-21 discussed (human): a left→right highlight sweep on the live
  activity line, card fronts only; the sweep runs only while live (a stale line
  freezes, reusing c0109's flag) and is disabled under
  `prefers-reduced-motion`. Rejected a ticking elapsed timer, a pulsing dot,
  and extending to the title bar / detail view.
