---
id: c0093
title: Companion scaffold + board watcher + state file
status: review
epic: e08
created: 2026-07-19
updated: 2026-07-19
status-changed: 2026-07-19T10:12:00
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

- [x] `gello-companion` runs as a standalone Node CLI reusing `src/lib`; no
      duplicated board parsing (imports `loadBoard`/types from `src/lib`)
- [x] It watches `.gello/` and detects a card entering `ready` (emitting an
      internal dispatch intent — logged; run wiring is c0097)
- [x] It writes an atomic state file under `.gello/.companion/state.json` with
      a documented shape (status, ready[], runs[], updated), starting `idle`
- [x] No-board case handled gracefully (walk-up finds `.gello` or exits with a
      message); the companion needs no git repo
- [x] The state-file shape is documented (the `CompanionState` interface in
      `companion/core.ts`) for the app side (c0100) to read

## Notes

Absorbs c020 (tiny gello CLI): `ls`/`next`/`move`-style queries can layer on
the same CLI later; this card only needs the watch + state-file base.

- **Layout**: `companion/` (outside `src/`) holds the CLI — `core.ts` (pure +
  Node-FS helpers) and `main.ts` (entry). It imports the *pure* board core
  from `src/lib` (`loadBoard`, types) and does its own FS. Kept out of
  `src/lib` because that dir bans direct `node:fs` (app code goes through
  Tauri); the ban is scoped to `src/**`, so `companion/` is the right home.
- **Core (tested, `companion/core.test.ts`, 8 tests)**: `readBoardFiles`
  (recursive, forward-slash paths, mirrors the Rust command), `findBoardRoot`
  (walk-up for `.gello`), `cardsEnteringReady(prev, next)` (the dispatch
  trigger; null prev → all ready cards), and the `CompanionState` + atomic
  `writeStateFile` (temp+rename).
- **Runtime**: `pnpm companion [dir]` (runs via `tsx`, added as a devDep —
  Node's ESM resolver can't follow `src/lib`'s extensionless imports).
  `companion/` added to tsconfig `include` so it typechecks.
- **State file** `.gello/.companion/state.json` is gitignored (per-machine
  runtime state, not board content). `{ status, ready[], runs[], updated }`;
  c0093 only publishes `idle` + the current `ready` ids.
- **Verified** by running `pnpm companion .` against this repo's board: it
  logged the dispatch intent for the card in `ready` (c0093) and wrote the
  state file with `ready: ["c0093"]`; a probe card set to `ready` was detected
  live. Full suite 515 green, typecheck + lint clean.

## Log

- 2026-07-19 created from the e08 companion breakdown
- 2026-07-19 status → ready (app)
- 2026-07-19 implemented TDD (agent): `companion/` CLI on the shared `src/lib`
  board core — readBoardFiles / findBoardRoot / cardsEnteringReady / state
  file (8 core tests), watcher + `pnpm companion` entry; verified against the
  live board. 515 green; status → review
- 2026-07-19 status → ready (app)
