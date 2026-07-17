---
id: i0010
title: initializing a new window does not ask for adding skills
status: review
priority: normal
type: issue
created: 2026-07-17
updated: 2026-07-17
milestone: m01
status-changed: 2026-07-17T10:16:42
order: 10
---

even after reload I am not asked. I set do not ask again for the gello project. maybe that bleeds

## Log

- 2026-07-17 status → ready (app)

## Notes

- Confirmed the user's hunch: the "don't ask again" choice was stored under a
  single global flag (`skills-prompt-dismissed`), so dismissing it for one
  project suppressed the prompt for **every** project — including freshly
  initialized ones.
- Fix: the flag is now keyed per project path
  (`skills-prompt-dismissed:<projectPath>`) for both the read (effect) and the
  write (Don't-ask button). A dismissal in project A no longer bleeds into B.
- The old global flag is now inert; the gello repo itself doesn't re-prompt
  because its skills are already present and current (i0009).
- Test: a dismissal for a different project does not suppress this one.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 per-project dismissal key, test-first, status → review
