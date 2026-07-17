---
id: c0066
title: Move the searchbar into the topbar
status: done
priority: normal
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T16:05:13
milestone: m02
---

## What

The fulltext search box (c022) moves out of the board toolbar into the frameless
top bar (TitleBar), centered in the bar (3-col grid: title | search | filler).
The title keeps its left column and clips with an ellipsis rather than crowding
the search. The `query`
state is lifted to App and applied by the Board via a `query` prop; the board
toolbar is now just the milestone/type filters.

## Acceptance criteria

- [x] Search box centered in the top bar; a long title clips instead of overlapping it
- [x] Typing filters the board (across columns + done), Escape clears, Cmd/Ctrl+F focuses
- [x] The search input stays interactive (not swallowed by the window drag region)

## Notes

- Only the caption + a flex filler carry `data-tauri-drag-region`; the input
  does not, so it's focusable in the frameless window.
- Search input behaviors (Escape-clear, Cmd+F) moved from Board to TitleBar
  with their tests; Board's search tests now drive filtering via the `query`
  prop. Verified the top-bar layout in the in-app browser.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): search box relocated to the TitleBar; query
  lifted to App, board filters via prop; drag-region kept off the input.
- 2026-07-17 refined (agent): centered the search in the top bar (grid
  title|search|filler); long title clips via minmax(0,1fr) + ellipsis.
- 2026-07-17 refined (agent): true-centred the search — full-width grid with
  the traffic-light inset moved into the title column so it no longer offsets
  the centre (verified against a window-centre reference).
- 2026-07-17 status → done (app)
