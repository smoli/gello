---
id: c0093
title: Companion scaffold + board watcher + state file
status: ready
epic: e08
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T10:00:11
---

## What

The foundation for the companion (root of e08). A standalone **Node CLI on
the shared `src/lib` board core** (loader/watcher) — this realizes and
absorbs c020's "tiny gello CLI". It watches `.gello/`, detects a card
entering `ready`, and publishes a companion **state file** the app reads.

- CLI scaffold reusing `src/lib` (no reimplemented board logic); runs
  headless, no GUI needed.
- Board watch → detect a card transitioning into `ready` → emit a dispatch
  intent (the dispatch flow itself is c0097).
- Define + publish the `.gello/` **state-file contract**: a JSON file (e.g.
  `.gello/.companion/state.json`) describing runner status (starts `idle`),
  active runs, and per-card flags. Written atomically; the app watches it.

## Acceptance criteria

- [ ] `gello-companion` runs as a standalone Node CLI reusing `src/lib`; no
      duplicated board parsing
- [ ] It watches `.gello/` and detects a card entering `ready` (emitting an
      internal dispatch intent)
- [ ] It writes an atomic state file under `.gello/` with a documented shape
      (status, runs[], per-card flags), starting at `idle`
- [ ] Not-a-git-repo / no-board cases are handled gracefully
- [ ] The state-file shape is documented for the app side (c0100) to read

## Notes

Absorbs c020 (tiny gello CLI): `ls`/`next`/`move`-style queries can layer on
the same CLI later; this card only needs the watch + state-file base.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)
