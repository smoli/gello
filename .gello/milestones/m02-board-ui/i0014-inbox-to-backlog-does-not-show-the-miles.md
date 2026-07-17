---
id: i0014
title: Inbox to Backlog does not show the milestone picker
status: done
priority: normal
type: issue
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T13:22:40
milestone: m02
---

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## What

An inbox card is already `backlog` (it lives in the inbox column), so dropping
it on the **backlog** column hit the `status === column` no-op guard and the
i0005 milestone picker never appeared. The triage intent (assign a milestone)
is real regardless of status, so the picker check now runs before the
same-status guard, in both the column-drop and positioned-insert paths. Same
fix makes a discuss inbox card re-dropped on discuss offer the picker too.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 fixed (agent): milestone-picker check moved ahead of the
  same-status no-op guard in dropOnColumn/dropAtIndex, so a backlog inbox card
  dropped on backlog now prompts. Reproducing Board test added.
