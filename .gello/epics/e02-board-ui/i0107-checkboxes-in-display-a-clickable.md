---
id: i0107
title: Checkboxes in display a clickable
status: done
type: issue
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:41:11
epic: e02
---

## What

When just displaying card details, task-list checkboxes were clickable and
exposed confusing behavior. Render them read-only instead: a task's state is
changed by editing the body, not by clicking the rendered box.

This reverses the c015 toggle feature by decision of the human (see Discussion).

## Acceptance criteria

- [x] Task-list checkboxes in the rendered card detail are disabled (not clickable).
- [x] Clicking a display checkbox writes nothing to the file.
- [x] Checkboxes still reflect the task's checked/unchecked state.
- [x] The dead toggle path is removed (`onToggleTask`, `handleToggleTask`,
      `toggleTaskItem`).
- [x] concept.md updated to match (checkbox toggling removed from the MVP list
      and the c015 surgical-edit policy).

## Discussion

- **Decision**: make display checkboxes read-only rather than fixing
  persistence. The rendered display works like GitHub — task checkboxes are
  disabled; editing the body is how you change them.
- **Rejected**: keeping them clickable and fixing a persistence bug. Reading
  the code, the toggle path (`handleToggleTask` → rebase-on-disk → surgical
  write → optimistic update) already persisted in the plain case, so there was
  no reproducible bug — only the confusion of a clickable box.
- Removing the feature contradicted concept.md, which listed "checkbox
  toggling" as a card-detail capability; the spec was updated as part of this
  change.

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
- 2026-07-20 status → review (agent)
- 2026-07-20 status → done (app)
