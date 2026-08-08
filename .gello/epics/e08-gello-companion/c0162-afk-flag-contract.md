---
id: c0162
title: AFK flag contract + companion reads it
status: review
epic: e08
depends: []
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:44:42
usage-tokens: 28811
usage-cost: 4.737796
---

## What

The foundation for AFK mode ([[c0161]]): a files-truth flag the app writes and
the companion watches. Define the `.gello/` file/field that carries the AFK
on/off state (`afk`, off by default). The companion reads it on start and
re-reads it on change via the watcher, applying the change without a restart,
and exposes the current AFK state to the dispatch layer. The published state
file is companion→app; this flag is app→companion, so it needs its own
app-written file/field, separate from the published state.

## Acceptance criteria

- [x] The AFK flag has a defined location/format in `.gello/` (documented),
      off by default.
- [x] The companion reads the flag on start and re-reads it on change (via the
      watcher), with no restart.
- [x] The companion exposes the current AFK state to the dispatch layer.
- [x] Toggling the flag on disk flips the companion's AFK state — unit-tested by
      writing the file.
- [x] With no flag present, AFK is off (safe default).

## Notes

The contract:

```
.gello/.companion/afk.json     {"afk": true}
```

- **Location** — `.companion/`, beside `control.json`, with the app as sole
  writer and the companion as sole reader (no two-writer race). AFK is a
  momentary, per-machine switch, so it does not belong in committed board
  content; `.companion/` is gitignored. Unlike `control.json` it carries level
  state, not a request log — the companion reads the current value rather than
  acting on entries once.
- **Off unless the file says `{"afk": true}`** — absent file, unparseable
  content, missing field, non-boolean value all read as off. The unattended
  behaviours stay off on anything unclear.
- **Companion side** — `companion/afk.ts` (`afkPath`, `parseAfk`, `readAfk`,
  `afkFileContent`, `syncAfk`). `main.ts` calls `syncAfk` at startup and on each
  `.companion/afk.json` watcher event; a change sets it on the runner, logs
  `AFK on`/`AFK off`, re-syncs (the flip can change what may dispatch) and
  republishes.
- **Dispatch layer** — `Runner.isAfk()` / `setAfk()`. Nothing reads `isAfk()`
  yet; [[c0163]] (park-and-skip) and [[c0167]] (review dispatch) are the
  consumers.
- **Echoed in `state.json`** as `afk`, so the app can tell a running companion
  picked the toggle up. Optional on both `CompanionState` types — a state file
  written before this card has no field, which reads as off.
- The app-side writer is [[c0169]]; it mirrors `afkFileContent` in `src/lib`
  the way `companion-control.ts` mirrors `control.ts` (the app does not import
  from `companion/`).

Beyond the unit tests, the watcher wiring in `main.ts` (untested code) was
smoke-tested against a scratch board: toggling the file flipped `state.json`
both ways with no restart, and a companion started with the flag already on
came up in AFK.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-08 status → in-progress (agent)
- 2026-08-08 flag contract `.companion/afk.json` `{"afk": true}`; companion
  reads it at start + on change, exposes it as `Runner.isAfk()`, echoes it in
  `state.json`. Documented in companion/README.md.
- 2026-08-08 status → review (agent)
