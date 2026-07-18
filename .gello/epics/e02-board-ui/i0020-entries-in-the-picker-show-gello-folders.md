---
id: i0020
title: Entries in the picker show .gello folders
status: done
type: issue
ref: i0019
epic: e02
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T23:21:39
---

## What

After i0019 made the picker show the last path segment, recent entries that
point at a board dir render as `.gello`. The current project is fine because
it goes through `projectFolder(...).path` (strips `.gello`), but the recent
list is loaded straight from the app-local store (`setRecent(parseRecent(r))`
in App.tsx) with no stripping. Older builds stored the raw `.gello` board dir,
so those legacy entries show up as `.gello`.

Fix: normalize recent entries to the project-folder path (strip a trailing
`.gello` segment, separator-agnostic) on load and when remembering, de-dup any
entries that collapse together, and persist the cleaned list so the store
self-heals. This also makes opening a recent entry use a consistent project
path.

## Acceptance criteria

- [x] `normalizeRecent(["/Users/x/proj/.gello"])` → `["/Users/x/proj"]`
- [x] Windows: `normalizeRecent(["C:\\ILC\\gello\\.gello"])` → `["C:\\ILC\\gello"]`
- [x] Entries that collapse to the same project are de-duped, order preserved
      (e.g. `[".../gello/.gello", ".../gello"]` → `[".../gello"]`)
- [x] Already-clean paths and paths without a `.gello` segment pass through
- [x] Trailing separators tolerated (`.../proj/.gello/` → `.../proj`)
- [x] On load the store is re-serialized with the normalized list (self-heal)
- [x] Regression covered by tests that fail before the fix, pass after

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → in-progress: picked up; recent list loaded unstripped in
  App.tsx while currentPath goes through projectFolder. Follow-up to i0019.
- 2026-07-17 status → review: added `normalizeRecent` (recent.ts, reuses
  projectFolder); normalize + persist on load and in rememberProject. 5 new
  unit tests (fail before, pass after). Suite 426/426 green.
- 2026-07-17 status → done (app)
