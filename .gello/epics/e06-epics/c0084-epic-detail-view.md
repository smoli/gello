---
id: c0084
title: Epic detail view (goal / DoD editor + child rollup)
status: backlog
type: task
created: 2026-07-18
updated: 2026-07-18
epic: e06
depends: [i0028]
---

## What

The full epic detail view — the CardDetail-sized sub-piece split out of
[[i0028]] (which ships a minimal stub). Opened by selecting an epic (group
header / filter), it edits `epic.md` and rolls up the epic's child cards.

- **Goal / Definition of done editor** — edit the epic's `## Goal` and
  `## Definition of done` sections with the same surgical, watcher-safe write
  discipline as CardDetail (rebase-on-disk per c015).
- **Epic frontmatter** — title + `status` editable.
- **Child-card rollup** — list the epic's cards grouped by status with a
  count / progress summary; click a child to open its CardDetail.
- **Consistent chrome** — dialog styling, Escape to close, live reconcile.

## Acceptance criteria

- [ ] Selecting an epic opens the detail view (replaces i0028's minimal stub)
- [ ] Goal and Definition of done are editable and persist surgically to
      `epic.md`, merging with external edits (c015)
- [ ] Title and status are editable
- [ ] The view lists the epic's child cards grouped by status with a rollup
      count; clicking one opens its CardDetail
- [ ] External changes to `epic.md` or its cards reconcile live

## Notes

Split from i0028 per the human's scope call (2026-07-18): creation ships the
minimal view; this card builds the real one.

## Log

- 2026-07-18 created (agent): split out of i0028 as its dependency-inverse —
  i0028 ships epic creation + a minimal view; this replaces the stub with the
  full editor + child rollup.
