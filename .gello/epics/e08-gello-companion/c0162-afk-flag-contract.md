---
id: c0162
title: AFK flag contract + companion reads it
status: backlog
epic: e08
depends: []
created: 2026-08-08
updated: 2026-08-08
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

- [ ] The AFK flag has a defined location/format in `.gello/` (documented),
      off by default.
- [ ] The companion reads the flag on start and re-reads it on change (via the
      watcher), with no restart.
- [ ] The companion exposes the current AFK state to the dispatch layer.
- [ ] Toggling the flag on disk flips the companion's AFK state — unit-tested by
      writing the file.
- [ ] With no flag present, AFK is off (safe default).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
