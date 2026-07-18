---
id: c0082
title: Epic-planning skill (gello-discuss sibling)
status: review
epic: e06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T09:46:09
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

- [x] Skill interviews, then writes a plan + dependency graph into `epic.md`
- [x] On explicit approval it creates child cards in the epic folder with
      `depends:` wired; nothing is created before approval
- [x] The skill is self-contained (embeds the schema + folder + id rules it
      needs) and gello-managed
- [x] Installed by the c032 installer alongside discuss/onboard
- [x] Skill name settled → **`gello-plan`** (verb-form, matching gello-discuss/onboard)

## Notes

Dogfooding target: re-running this skill on a fresh epic should reproduce
the kind of breakdown that created m06.

## Log

- 2026-07-18 created from the c0074 epic breakdown (dry run)
- 2026-07-18 status → ready (app)

## Discussion

- **Name** (open question in card): chose **`gello-plan`** over `gello-epic` —
  the sibling skills are verb-form (discuss, onboard), and "plan" names the
  action; `gello-epic` reads like a noun/subject. AFK call; easy to rename.

## Log

- 2026-07-18 implemented (agent): added PLAN_SKILL to src/lib/skills.ts
  (self-contained: epic-format schema, id/folder rules, two-phase plan→approve
  →create, depends-wiring), registered in ALL_SKILLS so the c032 installer
  ships it. Bumped SKILL_VERSION 2→3 and swept discuss/onboard templates from
  milestone→epic vocabulary (finishing c0081's skill corner). Regenerated the
  checked-in .claude/skills installs (v3 markers). README lists three skills.
  Tests + typecheck + lint green.
