---
id: i0114
title: Tags too light in dark mode
status: ready
type: issue
ref: c0058
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T22:35:33
---

![image](../assets/i0114/image.png)

## What

Tag chips tint their fill toward white (i0110/i0113 resting look). Over a dark UI
that pale fill reads as a glaring near-white pill and the tag hue washes out. In
dark mode a chip should shade its fill *down* toward a dark base instead, keeping
the hue and taking light text.

## Acceptance criteria

- [x] `tagChipStyle` takes a `dark` flag: light mode tints toward white (as
  before), dark mode shades toward a dark base with light text.
- [x] The effective scheme is resolved from the theme setting — a forced
  `light`/`dark` override wins, `system` follows the OS `prefers-color-scheme`.
- [x] All three chip surfaces (toolbar filter, card fronts, tag manager) shade
  together in dark mode.

## Notes

- The theme override (c0068) is applied only as `color-scheme` on the document,
  which does not drive the `prefers-color-scheme` media query — so the chip fills
  (computed in JS, not CSS) resolve dark mode themselves: `theme === "dark"`, or
  `system` + `matchMedia("(prefers-color-scheme: dark)")`. `App` tracks that and
  threads a `darkChips` flag to `Board` and `TagManager`.
- Selected filter chips keep the full-colour fill (unchanged); only the resting
  fill shades.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 status → ready (app)
