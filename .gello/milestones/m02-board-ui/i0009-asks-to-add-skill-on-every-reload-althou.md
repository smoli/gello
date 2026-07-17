---
id: i0009
title: asks to add skill on every reload although skills already present
status: done
priority: normal
type: issue
created: 2026-07-17
updated: 2026-07-17
milestone: m02
status-changed: 2026-07-17T10:06:05
---

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Cause: the skill prompt appeared whenever a skills dir existed, without
  checking whether anything actually needed installing — so once skills were
  present (as in gello's own repo), it nagged on every board open.
- Fix: the effect now reads each target's SKILL.md and only prompts when
  `dirsNeedingInstall` finds at least one missing/outdated skill (pure,
  installDecision-based). All-present-and-current → no prompt. The Install
  action already skipped current files, so this just aligns the prompt's
  visibility with real work.
- Reproducing test: skills present + current → no prompt; missing → prompt.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 prompt gated on pending installs, test-first, status → review
