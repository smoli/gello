---
id: i0010
title: initializing a new window does not ask for adding skills
status: done
priority: normal
type: issue
created: 2026-07-17
updated: 2026-07-17
milestone: m01
status-changed: 2026-07-17T10:44:14
---

even after reload I am not asked. I set do not ask again for the gello project. maybe that bleeds

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

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

## Update: the real cause (detection required a pre-existing skills/ subdir)

- The dismissal-bleed fix above was real but not the whole story. Detection
  required `.claude/skills/` (etc.) to *already exist*; a typical project (and
  a freshly-initialized one) has `.claude/` without a `skills/` subdir, so
  nothing was detected and no prompt appeared.
- Fix: `detect_skill_dirs` now detects the agent *root* (`.claude`, `.pi`,
  `.agents`) and returns its `skills/` path whether or not that subdir exists.
  Install creates it — the skill write switched from writeFileAtomic to
  `write_new_files` (mkdir -p + atomic). gello still never creates the agent
  root itself, so it won't introduce an ecosystem into a project without one.
- Boundary (by design): a project with *no* `.claude`/`.pi`/`.agents` at all
  is still not prompted — gello won't invent an agent folder. Say so if you
  want that too.
- Rust detection tests updated (root-exists → skills path); App install test
  now asserts the write_new_files payload.

## Log

- 2026-07-17 per-project dismissal key, status → review
- 2026-07-17 broadened detection to agent roots + create skills/ on install, status → review
