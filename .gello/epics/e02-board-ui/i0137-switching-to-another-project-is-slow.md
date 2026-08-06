---
id: i0137
title: Switching to another project is slow
status: review
type: issue
ref: c0146
epic: e02
created: 2026-08-06
updated: 2026-08-06
status-changed: 2026-08-06T06:00:49
---

I know that a lot of data needs to be read but it takes at least a second for teh UI to update. Maybe by reordering the load (clearing current collunmns, then background, then cards info) we can give the user more visual feedback. Or some busiy indicator.

## Acceptance criteria

- [x] Switching projects (Ctrl+Tab, the project menu, a recent, or the folder
      picker) shows an immediate busy indicator naming the project being opened
- [x] The indicator clears the moment the new board is on screen
- [x] It covers whichever view the switch starts from (board view or the
      no-board placeholder)
- [x] The spinner respects `prefers-reduced-motion` (label alone under reduce)

## Notes

- Chose the busy indicator over reordering the load: the ~1s is one
  `read_board_files` IPC plus the synchronous `loadBoard` parse — not
  separable into columns/background/cards without streaming the read, a much
  bigger change. A spinner gives the feedback the card is really after.
- All switches funnel through `openProject`, so the busy state is set there: it
  paints *before* the first `await`, so React shows the overlay while the slow
  read/parse runs, and a `finally` clears it (covering the no-board/error path
  too). The overlay names the project (`projectDisplayName`, the folder base).
- Rendered in both the board view and the placeholder, like the c0146 switcher
  overlay, so a switch started from either shows it. `role="status"` +
  `aria-live` so it is announced.
- The spinner is CSS-only and can't be seen in jsdom; the test drives the
  wiring — a switch with a deferred `loadBoardAt` shows the indicator, and
  resolving the load swaps the board in and clears it.

## Log

- 2026-08-06 status → in-progress (agent)
- 2026-08-06 busy "Opening <project>…" overlay while a switch reads/parses the
  board, set in openProject before the await and cleared in finally — 1 test
- 2026-08-06 status → review (agent)
