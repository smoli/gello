---
id: i0035
title: Indicator alignment is off
status: done
type: issue
ref: c0100
epic: e08
created: 2026-07-19
updated: 2026-07-20
status-changed: 2026-07-20T07:36:01
---

![image](../../assets/i0035/image.png)

The c0100 companion indicator (right, hollow `○`) doesn't line up with the
c0083 dirty dot (left, amber `●`): different size and vertical position.

## Cause

The runner indicator was styled inconsistently with the dirty dot: a larger
font-size (`0.75em` vs the dirty dot's `0.7em`) and a `<button>` with
horizontal padding and no centered box, so its glyph rendered at a different
size and sat off the dirty dot's baseline (the glyph also varies — `○` / `▶` /
`?`).

## Fix

`.titlebar-runner` now matches the dirty dot: `font-size: 0.7em`, no padding,
and `inline-flex` centering in a `min-width: 1em` box so any of the glyphs
stays centered on the same baseline; `.titlebar-runner-wrap` centers its child.
CSS-only ([src/components/TitleBar.css](../../../src/components/TitleBar.css)).

## Log

- 2026-07-19 status → ready (app)
- 2026-07-19 fixed the runner-indicator alignment (font-size + centered box to
  match the c0083 dirty dot). CSS-only; no test change (layout/styling).
  Browser-preview screenshot unavailable (the preview tooling wouldn't render
  the static harness), so verified by reasoning against the c0083 dot's rules.
  status → review.
- 2026-07-20 status → done (app)
