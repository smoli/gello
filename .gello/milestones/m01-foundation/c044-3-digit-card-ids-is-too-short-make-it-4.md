---
id: c044
title: 3 digit card ids is too short, make it 4 to be save
status: review
priority: normal
created: 2026-07-16
updated: 2026-07-16
milestone: m01
---

## Log

- 2026-07-16 status → ready (app)

## Notes

- New allocations in both namespaces pad to 4 digits (`c0056`, `i0001`);
  **existing IDs are never renumbered** — refs, logs, and commit mentions
  stay intact. The board will carry mixed widths during the transition.
- Fixed alongside: ID ordering was lexicographic, which would have
  misordered mixed widths (`c0056` < `c055` as strings) — `compareIds` now
  compares numerically within a namespace. Test covers the exact c055/c0056
  case.
- concept.md documents both namespaces; allocation parsing was already
  width-agnostic.

## Log

- 2026-07-16 captured via quick capture (Stephan)
- 2026-07-16 status → ready (app)
- 2026-07-17 implemented (4-digit padding + numeric id ordering), status → review
