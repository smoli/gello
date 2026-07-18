---
id: c036
title: Bug in c024
status: done
type: issue
ref: c024
epic: e01
created: 2026-07-16
updated: 2026-07-16
---
Filtering by bugs shows regular cards in inbox

## Notes

- Fixed: the type filter now also applies to the inbox column (it previously
  only filtered the status columns). Milestone filter deliberately still
  ignores the inbox — inbox cards have no milestone; type is the axis that
  applies to them.
- Process note: picked up straight from backlog (not ready) — same-area
  two-line fix while c034/c035 were on the bench, avoiding a signal
  round-trip.

## Log

- 2026-07-16 reported via report-bug flow (Stephan), ref c024
- 2026-07-16 fixed (agent), test-first, status → review