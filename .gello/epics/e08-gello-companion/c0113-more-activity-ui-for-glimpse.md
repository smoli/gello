---
id: c0113
title: More activity ui for glimpse
status: in-progress
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T12:38:49
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

- [x] A live activity line on a card front shows a looping left→right highlight
      sweep
- [x] A stale activity line does **not** animate — it keeps today's dim+italic
      treatment
- [x] `prefers-reduced-motion: reduce` disables the sweep, leaving the current
      static line
- [x] The sweep reads correctly in light *and* dark themes (colours derived
      from `CanvasText`, not hard-coded)
- [x] The line keeps its single-line truncation with ellipsis
- [x] Nothing animates when there is no activity (no companion, or the card
      isn't running)
- [x] Which treatment applies (animated / stale / none) is driven by the
      activity's live-vs-stale state and is unit-testable, separate from the CSS

## Notes

- 2026-07-21 (agent) **Treatment is picked in TS, drawn in CSS.** `activity.ts`
  gains `activityTreatment(activity) → "animated" | "stale" | "none"` and
  `activityClassName(treatment)`. The card front now has no branching of its own,
  and the rule ("motion means live") is unit-tested without touching CSS.
  It reads c0109's existing `stale` flag — no new state.
- **Open question resolved — overlay, not `background-clip: text`.** The card
  flagged that the usual gradient-sweep technique fights `text-overflow:
  ellipsis`; it does, because the ellipsis is *generated* rather than part of the
  text run, so it does not reliably pick up a text-clipped background. Rather
  than add a fallback, the sweep is an overlay pseudo-element
  (`.card-activity-live::after`, a translucent band translated across and clipped
  by the existing `overflow: hidden`). Text rendering is untouched, so the
  truncation keeps working by construction rather than by patch.
- **Open question resolved — period and intensity.** 2.6s linear, and a band
  peaking at `color-mix(in srgb, CanvasText 20%, transparent)`. The line's own
  `opacity: 0.7` mutes it further, which is what keeps a full board of cards calm.
  Theme-derived, so no light/dark branch.
- **Reduced motion removes the band** (`content: none`) instead of pausing it —
  `animation: none` would strand a visible band mid-line, which is worse than no
  effect. What is left is byte-for-byte the pre-c0113 line.
- **Open question not taken — pausing when the window is unfocused.** Left out
  deliberately: browsers already throttle animations in unfocused/occluded
  windows, and tracking focus would add exactly the app state this card set out
  to avoid. Worth revisiting only if it shows up in a battery measurement.
- **Test-fixture fix found on the way.** The c0109 `Board` fixtures stamped
  `updated` with `toISOString()` (UTC) while the app parses it as *local*, so on
  a UTC+2 machine they were silently ~2h stale and exercised the wrong branch.
  They passed only because they assert label text. Replaced with a `localNow()`
  helper, so those tests now really do cover a live line — which c0113 depends on.

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
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 (agent) implemented: `activityTreatment`/`activityClassName` in
  activity.ts (7 unit tests) pick animated/stale/none; the card front renders the
  class and an overlay `::after` band sweeps left→right, frozen when stale and
  removed under `prefers-reduced-motion`. Resolved the card's open questions
  (overlay instead of `background-clip: text`; 2.6s at 20% CanvasText) and left
  unfocused-window pausing out on purpose. Also fixed UTC-vs-local `updated`
  stamps in the c0109 Board fixtures. 853 frontend tests, typecheck, lint and a
  production build all green.
