---
id: c032
title: Provide skill for discussion
status: done
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T09:41:42
---

When initiaing a project with gallo look if there’s a place for skills, e.g. .claude or .pi folder and put a skill in there that the user can use to discuss a card in status discussion

## What

When the desktop app creates a new `.gello/` board — or opens a project
where the skill is missing — it detects agent skill locations
(`.claude/skills/`, `.pi/skills/`, `.agents/skills/`) and, after a one-time
confirmation, installs a
gello-managed **discuss** skill into each detected location. The skill lets
the user run a structured discussion of a card in `discuss` status: take a
card ID (or list discuss cards), read the card, interview the human (goal,
scope, constraints, edge cases, what done looks like), write the outcomes
back (refined `## What`, drafted `## Acceptance criteria`, compact
`## Discussion`), then offer triage — executed only on the human's explicit
say-so.

## Acceptance criteria

- [x] On board create/open, the app detects `.claude/skills/`,
      `.pi/skills/`, and `.agents/skills/`; folders that don't exist are
      never created
- [ ] When both `.pi/skills/` and `.agents/skills/` exist, the skill is
      installed only into `.agents/skills/` (pi discovers both — one copy,
      no duplicate skill)
- [x] First install asks the user once; a decline is remembered and not
      re-prompted on every open
- [x] The installed skill file carries a gello-managed marker + version;
      newer gello versions update it silently unless the user has edited
      the file, in which case it is left untouched
- [x] Skill content is self-contained: includes the board query recipes it
      needs, so it works in projects whose CLAUDE.md says nothing about
      gello
- [x] Skill flow: optional card ID arg (else list discuss cards) →
      interview → write back What / Acceptance criteria / Discussion →
      offer triage; any triage move (folder move + status change, with
      relative asset-link rewriting) happens only on explicit human
      confirmation
- [x] Installs/updates are atomic writes
- [x] Template content is covered by a test (marker present, copies
      byte-for-byte)

## Discussion

- **Trigger = app on board create/open**: no dependency on the c020 CLI
  (backlog/low); the app is what every gello user runs anyway.
- **Locations: `.claude/skills/`, `.pi/skills/`, `.agents/skills/` —
  existing only**: matches the card's "look if there's a place" — gello
  never introduces an agent ecosystem into a project that doesn't use it.
  Per pi's docs (2026-07-16), pi discovers project skills in `.pi/skills/`
  and `.agents/skills/` (cwd + ancestors, only after the project is
  trusted — trust is pi's concern, not gello's). Dedupe rule: prefer
  `.agents/skills/` over `.pi/skills/` when both exist. Both ecosystems
  use the SKILL.md folder format, so one template serves all locations.
- **Skill scope: interview + write-back + offer triage**: triage stays a
  human decision, the skill just executes it on request. Teaching broader
  board conventions (statuses, query recipes for general work) was
  deliberately excluded — that's onboarding territory ([[c029]]), though
  the skill embeds the few recipes it itself needs.
- **Update policy: managed marker, silent update, user edits win** (ask
  once, overwrite managed file; hands-off once the user customizes).
- **Installer should be generic**: c029 (onboard-legacy-projects skill)
  will want the same detect/confirm/install/update mechanism — design it
  as "gello installs skills", with discuss as the first skill.
- **Open**: where the "user declined" flag lives (app config vs.
  `board.yaml`); how user-edit detection works (content hash vs. version
  line).

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Generic installer (reused by c029): pure `src/lib/skills.ts` — managed
  marker (version + djb2 body hash), `installDecision` (install/update/skip:
  user-edited or unmanaged files are never clobbered), `resolveInstallTargets`
  (dedup `.pi/skills` when `.agents/skills` exists), `skillFilePath`,
  `DISCUSS_SKILL` template. 15 TS tests.
- Rust `skills.rs::detect_skill_dirs` (existing dirs only, never created) +
  commands; app-local flag persistence (`app_flag_get/set` → JSON in the OS
  app-config dir, atomic write) for the "don't ask" choice. 3 Rust tests.
- App: on board open, if not dismissed and skill dirs exist, a one-time
  SkillPrompt (Install / Not now / Don't ask again); Install writes the
  discuss SKILL.md into each target via the atomic write path, honoring
  installDecision so user edits survive. 3 App integration tests.
- The discuss skill is self-contained (embeds the board-query recipes and
  triage rules), so it works in projects whose CLAUDE.md never mentions
  gello — codifying the [[c027]] discuss convention as an installable skill.
- Deferred nuance: the SKILL.md's own discuss *flow* is instructional text
  for the agent, not executed/tested here; verified structurally (marker,
  byte-for-byte copy).

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (generic installer + discuss skill + one-time prompt),
  15 TS + 3 Rust tests, status → review
