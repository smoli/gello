---
id: i0007
title: Sorting a card up to the top produces error
status: done
type: issue
ref: c056
epic: e02
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:46:35
---

Edit produce invalid card: field orser must be a number

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Cause: dropping at the top of a manual column computes `below.order − 10`,
  which goes 0 then negative once the top card's order ≤ 10. `formatScalar`
  quoted any value with a leading `-`, so `order: "-10"` re-parsed as a
  string → "field order must be a number".
- Fix: numeric frontmatter values are now serialized verbatim (never routed
  through formatScalar's string quoting). Negatives are valid YAML numbers,
  so repeated top-sorts simply keep decrementing the rank — no error.
- Reproducing test covers order 0, −10, 5, 12.5 round-tripping as numbers.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 reproducing test red → fix (verbatim number serialization), status → review
