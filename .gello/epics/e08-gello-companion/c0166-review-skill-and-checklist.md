---
id: c0166
title: Review skill + checklist
status: ready
epic: e08
depends: []
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:35:43
order: 10
---

## What

The skill the AI review agent follows during AFK ([[c0161]]). It defines what
"reviewed" means for a gello card: verify the acceptance criteria are met,
tests pass, lint/typecheck are green, and the diff is sane against the card's
`## What`. It records a pass/fail verdict on the card (verdict + what was
checked, with reasons on fail) and, on pass, moves the card to `signoff`
([[c0164]]); on fail it leaves review notes for the implementer ([[c0168]]
wires the reject flow). Authored as a bundled skill/prompt the companion passes
to the review run ([[c0167]]).

## Acceptance criteria

- [ ] A documented review skill/checklist exists (acceptance criteria, tests,
      lint/typecheck, diff review).
- [ ] The skill specifies recording a verdict on the card (pass/fail + what was
      checked; reasons on fail).
- [ ] On pass, the skill instructs moving the card to `signoff`.
- [ ] On fail, the skill instructs writing review notes for the implementer (no
      move to `signoff`).
- [ ] The verdict/notes format is defined (e.g. a `## Review` section) so
      [[c0167]] / [[c0168]] can act on it.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
