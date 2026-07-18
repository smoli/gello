---
id: c0082
title: Epic-planning skill (gello-discuss sibling)
status: ready
priority: normal
milestone: m06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T06:09:25
---

## What

A gello-managed **epic-planning skill** (sibling to gello-discuss) that
breaks an epic into dependent child cards — the workflow this very milestone
was a manual dry run of.

- Interview the human about the epic (goal, scope, constraints).
- Draft a stepwise implementation plan + dependency graph into the epic's
  `epic.md`.
- Only on explicit approval, create the child cards in the epic's folder with
  `depends:` wired between them.
- Two-phase (plan → approve → create), mirroring gello-discuss's
  write-then-triage.

## Acceptance criteria

- [ ] Skill interviews, then writes a plan + dependency graph into `epic.md`
- [ ] On explicit approval it creates child cards in the epic folder with
      `depends:` wired; nothing is created before approval
- [ ] The skill is self-contained (embeds the schema + folder + id rules it
      needs) and gello-managed
- [ ] Installed by the c032 installer alongside discuss/onboard
- [ ] Skill name settled (`gello-plan` / `gello-epic`)

## Notes

Dogfooding target: re-running this skill on a fresh epic should reproduce
the kind of breakdown that created m06.

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)
