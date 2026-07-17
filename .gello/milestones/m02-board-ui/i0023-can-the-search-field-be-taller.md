---
id: i0023
title: Can the search field be taller
status: review
priority: normal
type: issue
ref: c0066
milestone: m02
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T00:19:55
order: 10
---

or is it limited by the fact that it is in the topbar now? How is this overdifferent OSes

## What

Make the top-bar search box taller. It *was* bounded by the 30px title bar
(which was hardcoded in four places). Centralised the bar height as a single
`--titlebar-height` CSS var, bumped it to 34px, and grew the search to
`bar - 8px` (≈26px, from 22px) with a slightly larger font.

## Answers to the questions

- **Limited by the top bar?** Yes — the field can't exceed the bar height. The
  bar (and thus the max field height) is now one variable to tune.
- **Across OSes?** The bar is the same height everywhere. macOS keeps its
  native traffic lights (they sit fine in 34px); Windows/Linux use the custom
  controls (i0017), which scale off the same var. The search field is
  identical on all three.

## Acceptance criteria

- [x] Search box is visibly taller than before
- [x] Bar height is a single source of truth (`--titlebar-height`); board and
      quick-capture offsets and the window controls all key off it
- [x] Same across macOS / Windows / Linux (traffic lights / custom controls
      both fit the taller bar)

## Log

- 2026-07-18 status → ready (app)

## Log

- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): centralised bar height as --titlebar-height,
  bumped to 34px, search grown to ~26px and widened to 20rem; CSS-only, verified in-browser.
