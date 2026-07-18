---
id: c014
title: File watcher with debounced board reconciliation
status: done
epic: e04
depends: [c003, c005]
tags: [core, rust]
created: 2026-07-16
updated: 2026-07-16
---

## What

Rust `notify` watcher on `.gello/` emits change events to the frontend; the
board reconciles (re-parse changed files only, debounced) without a full
reload. This is the "watch the agent work" feature.

## Acceptance criteria

- [x] External status edit moves the card on the board without reload
- [x] New/deleted card files appear/disappear
- [x] Burst of changes (agent editing many files) coalesces into one refresh
- [x] Self-inflicted writes don't cause redundant re-renders or loops
- [x] board.yaml changes re-render columns

## Notes

- Rust `fs_watch` (notify 8, recursive): filters to md/yaml/yml and drops our
  own `.gello-tmp.` files at the source. Tested against real FS events
  (create + temp/asset non-events with a sentinel). `watch_board` command
  emits root-relative paths as `board-files-changed`; watcher lives in
  managed state.
- Frontend: `watchBoard` subscribes to the event stream *before* starting the
  Rust watcher (no missed early events — asserted via call order). App
  coalesces bursts (150 ms debounce), re-reads only changed paths
  (`readFileRaw`, read-failure ⇒ deletion), and reconciles.
- **Reconciliation = rebuild through loadBoard**: BoardModel now carries
  `configRaw`, so the model can be reconstructed into its file list, changes
  applied, and `loadBoard` re-run — validation, grouping, ordering, and
  config rules apply identically to watched changes and fresh loads. No
  second parsing path to drift.
- **Self-write suppression falls out of the design**: our own atomic write
  echoes back, content equals the model's raw, `applyFileChanges` returns
  the same reference, React skips the re-render.
- board.yaml changes flow through the same path — including cards becoming
  invalid when their status column disappears (tested).
- Test-infra note: state updates driven by fake-timer callbacks need
  `act(async () => vi.advanceTimersByTimeAsync(...))` to flush.
- 21 new tests (3 Rust incl. real FS events, 18 frontend). Suite: 136 + 18.
- Demo: this very status change (in-progress → review) was watched live on
  the board with no reload.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 21 tests (red → green), live-verified on this card's own closeout, status → review
