---
id: c0078
title: Triage to an epic or to standalone cards/
status: ready
milestone: m06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T06:09:15
---

## What

Triage now has two exits: inbox → an epic folder, or inbox → `.gello/cards/`
(triaged, no epic). Reconcile the existing inbox-triage gestures with the
epic model.

- board-actions triage targets an epic folder OR `cards/`; asset links
  rewritten for the destination depth (`../../assets/` for an epic,
  `../assets/` for `cards/`).
- Reconcile [[i0005]] (status-drop → inline picker) and [[c028]] (drag to a
  target) against epics + a "no epic / standalone" target.

## Acceptance criteria

- [ ] Triage moves an inbox card into an epic folder (sets epic membership by
      location) or into `.gello/cards/` (standalone), atomically
      (write-new-then-delete)
- [ ] Relative asset links are rewritten to the destination depth
- [ ] The inbox-triage UI offers epics and a "no epic / standalone" target
- [ ] i0005 / c028 behaviours work against the epic model (or are refiled)

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
