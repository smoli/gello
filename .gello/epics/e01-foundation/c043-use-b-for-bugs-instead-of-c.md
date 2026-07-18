---
id: c043
title: Use b… for bugs instead of c
status: done
created: 2026-07-16
updated: 2026-07-17
epic: e01
---

## Log

- 2026-07-16 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- New issues (⌘I quick capture, "+ New issue" button, report-issue) allocate
  from an `i` namespace (`i001`, `i002`, …) with its own counter; tasks keep
  `c`. Filenames follow (`i001-slug.md`). Invalid i-files reserve their ids
  by filename, same as tasks.
- **Existing c-numbered issues keep their IDs** — renumbering would break
  every ref, log line, and commit mention. Only new allocations use `b`.
- CLAUDE.md board-query globs widened to `[ci][0-9]*.md`; concept.md
  documents both namespaces. Duplicate detection (c031) is namespace-
  agnostic (full-id keyed) and covers i-ids automatically.
- Interplay with c044 (4-digit ids, not in scope per Stephan's ordering):
  when picked up, both namespaces should widen together; `maxIdNumber`
  parsing is width-agnostic, so mixed 3/4-digit ids already sort correctly
  numerically.

## Log

- 2026-07-16 captured via quick capture (Stephan)
- 2026-07-16 status → ready (app)
- 2026-07-17 implemented (b-namespace allocation), 5 tests, status → review
- 2026-07-17 review feedback (Stephan): prefix corrected b → i (b was a
  bugs-era leftover); zero b-cards existed, so no migration
