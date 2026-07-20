---
id: i0107
title: Checkboxes in display a clickable
status: in-progress
type: issue
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:08:20
epic: e02
---

I dug into this before writing a test. Two things constrain the fix:

- **concept.md** lists "checkbox toggling" as an intended card-detail feature (lines 248, 284), so removing clickability outright would contradict the spec.
- The code already wires display checkboxes to `onToggleTask` → `handleToggleTask`, which reads the current disk bytes, does a surgical single-line edit, writes atomically, and updates the board optimistically. Reading that path, a plain card's checkbox toggle **does** persist — so I can't reproduce "nothing gets written" from the source, and a bug fix needs a failing test that reproduces the exact case.

**Which behavior do you want?**

- [ ] Keep checkboxes clickable in the display, but fix persistence — please tell me the repro: which card, what you clicked, what you expected vs. saw (e.g. a card with a parked agent question? a done card? a specific list nesting?). That failing case becomes the test.
- [x] Make display-mode checkboxes read-only (disabled), so a task's state is only changed by editing the body. This is simpler and kills the confusion, but it reverses the c015 toggle feature and contradicts concept.md — I'd update the concept and the two existing tests to match.
- [ ] Something else (describe below).

When just displaying card details, checkboxes are still clickable and expose weird behavior. Nothing gets written to the file but still it’s confusing for the user.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
