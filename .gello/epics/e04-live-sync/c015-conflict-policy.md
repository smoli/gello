---
id: c015
title: Concurrent-edit policy (last-write-wins, no silent loss)
status: done
epic: e04
depends: [c010, c014]
tags: [core]
created: 2026-07-16
updated: 2026-07-18
status-changed: 2026-07-18T18:10:06
---

## What

Define and implement the concurrency rules: app state is always derived from
disk; the only transient state is the active field edit. If the file under an
active edit changes externally, the user is prompted (keep mine / take disk),
never silently overwritten in either direction.

## Acceptance criteria

- [x] Documented policy in concept.md §8 matches implementation
- [x] External change during active edit → prompt, both choices tested
- [x] No path exists where a stale in-memory card overwrites newer disk state
- [x] Status drag during external edit of the same card merges (status from
      app, body from disk) — the field-level LWW case, tested

## Notes

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-18 status → done (app)

## Notes

Policy: app state is always derived from disk; the only transient state is the
active field edit. Two rules keep a human-on-the-board + agent-editing-files
from losing data:
- **Surgical edits** (drag/status/field/checkbox) rebase on the current disk
  bytes before writing (`rebaseCard` in `src/lib/conflict.ts`, wired via
  `rebaseOnDisk` in App). An unrelated external change survives — status from
  app, body from disk (field-level LWW). Closes the silent-overwrite path.
- **Full body edits** (inline editor) can't merge → prompt (Overwrite / Discard
  my edit). Was already implemented; added the take-disk test.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-18 implemented (agent): pure `rebaseCard` policy + `rebaseOnDisk`
  read-before-write on every surgical handler (move/reorder/renumber/field/
  toggle); documented in concept.md §8. Unit + 3 App integration tests
  (discard-my-edit, field-merge, move-merge). 469 tests green.
