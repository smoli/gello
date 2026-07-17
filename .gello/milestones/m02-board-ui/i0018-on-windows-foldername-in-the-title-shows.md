---
id: i0018
title: On windows foldername in the title shows the full path
status: review
priority: normal
type: issue
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T20:11:37
milestone: m02
---

## What

Bug (dogfooding): on Windows the title bar shows the whole path
(`gello: C:\Users\me\project\.gello (main)`) instead of just the project
folder name (`gello: project (main)`).

Root cause: `projectFolder` in [status.ts](src/lib/status.ts) parses only
POSIX paths — it strips a trailing `/`, a `/.gello` suffix, and takes the
basename via `lastIndexOf("/")`. Windows roots use backslashes
(`…\project\.gello`), so none of those match: `.gello` isn't stripped and
`lastIndexOf("/")` returns −1, yielding the full string.

Fix: make `projectFolder` separator-agnostic — handle both `/` and `\` when
trimming the trailing separator, stripping the `.gello` segment, and taking
the basename.

## Acceptance criteria

- [x] Reproducing test (fails before fix): a Windows-style root
      `C:\Users\me\project\.gello` yields name `project`, not the full path
- [x] Existing POSIX behavior unchanged: `/home/me/project/.gello` → `project`
- [x] Trailing separator and the `.gello` segment are stripped for both `/`
      and `\`
- [x] `windowTitle` renders `gello: project (branch)` on both platforms

## Discussion

- **POSIX-only path parsing**: the three operations in `projectFolder` all
  assume `/`. Simplest robust fix is a separator class `[/\\]` in the trim
  and strip regexes, and basename via the last index of either separator.
- **Pure + unit-tested**: `projectFolder` is already pure, so the fix is a
  jsdom/Vitest test with a Windows-style string — no Windows machine needed.
- **Open**: none — cause identified, fix scoped.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): root-caused to POSIX-only `projectFolder`;
  fix = separator-agnostic path parsing, unit-tested with a Windows path
- 2026-07-17 triaged (human): status → ready
- 2026-07-17 fixed (agent): projectFolder is now separator-agnostic ([/\\]) for
  trailing-sep trim, .gello strip, and basename. Windows-path tests added.
