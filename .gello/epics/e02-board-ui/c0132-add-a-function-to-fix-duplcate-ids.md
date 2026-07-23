---
id: c0132
title: Add a function to fix duplcate ids
status: in-progress
created: 2026-07-23
updated: 2026-07-23
status-changed: 2026-07-23T20:08:42
epic: e02
---

It is checked and a warning is presented. But there’s now way to fix it. Add a button to the message similar to the duplicate yaml-keys

## Acceptance criteria

- [x] A duplicate-id needs-attention entry shows a "Fix duplicate id" button,
      like the i0034 "Fix duplicate keys" one
- [x] Clicking it gives the duplicate a fresh id in its own namespace and
      writes the file; the watcher reloads it as a valid card
- [x] The owner of the id (the first occurrence) is never touched
- [x] The new id is written through the surgical frontmatter path — every
      other line survives byte-for-byte, `updated` is not bumped
- [x] The button appears only on a duplicate-id entry, not on a malformed-YAML
      or duplicate-keys one
- [x] Detection (is this a duplicate-id entry, and which id) is a pure,
      unit-tested function

## Notes

- Two small pure pieces, each unit-tested, mirroring the i0034 split:
  `reassignCardId(raw, newId)` in `cards.ts` (surgical `id:` rewrite via the
  existing `setFrontmatterRawValue`) and `duplicateIdOf(entry)` in `board.ts`
  (the clashing id from the needs-attention reason, or null). The reason string
  is now built and parsed in one place (`duplicateIdReason`) so the two can't
  drift.
- The duplicate is always the *non-owner* (c031 gives the id to the first
  occurrence by path order and sends every later copy to needs-attention), so
  the repair only ever writes that file. The owner keeps its id.
- The namespace comes from the clashing id itself (`i…` → issue, else task), so
  `nextIssueId`/`nextCardId` allocate in the right sequence. Those already count
  invalid-file basenames, so the fresh id can't re-clash.
- **In place, no rename** — matching the duplicate-keys precedent the card
  points to. The board keys off the frontmatter id, so rewriting it is enough
  to make the card valid; the filename keeps its old id-slug. Renaming the file
  (and its asset dir) would be tidier but is a bigger, riskier move the card
  didn't ask for. Flag if the filename/id mismatch bothers you.

## Log

- 2026-07-23 status → ready (app)
- 2026-07-23 status → in-progress (agent)
- 2026-07-23 "Fix duplicate id" button in needs-attention: reassignCardId +
  duplicateIdOf (pure, unit-tested) wired through Board and App — 10 tests
