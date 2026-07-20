---
id: i0106
title: Card writes resolved against the agent cwd, not .gello
status: done
type: issue
ref: c0105
epic: e08
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:33:33
---

## What

Clearing the `awaiting` marker failed on every parked card:

```
[gello-companion] c002 parked → waiting for input
[gello-companion] could not clear awaiting on c002: ENOENT: no such file or
directory, open '…/sandbox/cards/c002-greet.md.gello-tmp.89829'
```

The path is missing its `.gello` segment — the card is at
`sandbox/.gello/cards/c002-greet.md`.

## Cause

`RunnerOptions.root` was doing two incompatible jobs, and its doc comment
("Absolute `.gello` root (agent cwd + state location)") asserted they were the
same directory. They are not:

- the agent's spawn **cwd** is the project root — the agent works the repo
- **`card.path`** is relative to the `.gello` root, one level down

`main.ts` passed the project dir, so `join(opts.root, card.path)` resolved one
directory too high. The `clearAwaiting` code (c0105) trusted the comment.

The test missed it because the injected `writeCard` took a *relative* path and
only its content was asserted — the injectable bypassed the `join`, so the bug
could not be observed from a test.

## Fix

Split `root` into `cwd` (agent process) and `boardRoot` (`.gello`), so the two
can't be conflated. `writeCard` now receives the **absolute** path, making the
resolved location observable, plus a test pinning the two directories apart.

## Acceptance criteria

- [x] A parked card's `awaiting` marker is cleared without ENOENT
- [x] The agent still runs with the project root as its cwd
- [x] A test asserts the card write lands under `.gello` and the spawn cwd is
      the project root

## Log

- 2026-07-20 found while running the companion on the sandbox board; fixed and
  verified against the real paths (old → ENOENT, new → exists). status → review
- 2026-07-20 status → done (app)
