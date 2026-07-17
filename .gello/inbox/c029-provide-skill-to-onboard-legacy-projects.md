---
id: c029
title: Provide skill to onboard legacy projects
status: done
priority: normal
depends: [c032]
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T09:45:38
---

I have project already using other means fo task organisation. The tool could provide a skill/prompt that the user can use on an existing agentic project to move the project to gello, preserving the history as good as possible.

## What

A gello-managed **onboard** skill, delivered by the c032 skill installer,
that migrates an existing project's task organisation (TODO.md, plan files,
docs, issue lists — whatever is there) onto the gello board. The skill is
format-agnostic: it teaches the agent the gello target format and migration
principles, and lets the agent discover and interpret the legacy sources.

Flow: **inventory → propose → confirm → write.** The agent inventories the
project's planning artifacts, proposes a mapping (milestones to create,
card counts per status, what lands in inbox), the human confirms or adjusts
at that single checkpoint, then the agent writes the board.

History is preserved: completed work becomes `done` cards, dates come from
git where recoverable, every card cites its origin, and the legacy source
files are never touched by the skill. A legacy vision/spec doc may be
folded into `.gello/concept.md` — synthesized, with the original left in
place. The migration ends by writing `.gello/migration.md`: a list of all
now-obsolete legacy files; whether to remove them is always the user's
decision, never the skill's.

Safety gate: before doing anything, the skill checks for a clean git
working tree — if dirty, it warns and stops without writing.

## Acceptance criteria

- [x] Skill template ships alongside the discuss skill and is registered in
      the c032 installer (covered by the same template/marker tests)
- [x] Template is self-contained: embeds the card + milestone frontmatter
      schema, folder layout, ID allocation rules (sequential, no
      duplicates), and valid statuses — usable in a project whose CLAUDE.md
      says nothing about gello
- [x] Template instructs format-agnostic source discovery (planning
      markdown, task lists, docs folders, exported issues) rather than
      hardcoding specific formats
- [x] Template mandates the propose→confirm checkpoint: no board writes
      before the human approves the mapping; the proposal lists every
      item to be migrated (no sampling or truncation, however large the
      backlog)
- [x] Mapping principles in the template: source structure/phases →
      milestones; completed items → `done` cards; active/next work →
      `ready` at most (nothing lands `in-progress`); ambiguous items →
      inbox `backlog`
- [x] History rules in the template: created/updated recovered from git
      history of source files where possible (else today); each migrated
      card gets a provenance line in `## Log` citing file/item or issue;
      source files are left untouched — never edited, moved, or deleted
- [x] Template instructs a pre-flight check: git working tree must be
      clean; if dirty, warn the user and stop — no board writes, no files
      created
- [x] Concept folding: if a legacy vision/spec doc exists, the template
      offers to synthesize `.gello/concept.md` from it, leaving the
      original in place
- [x] The final step writes `.gello/migration.md` listing every legacy
      file made obsolete by the migration, stating explicitly that removal
      is the user's decision
- [x] Migrated board passes validation: parseable frontmatter, no duplicate
      IDs, only board.yaml statuses

## Discussion

- **Format-agnostic over per-format recipes**: legacy planning is never
  uniform; the skill teaches the target and the principles, the agent
  reads whatever exists. (Rejected: maintained recipes per source format;
  rejected: markdown-files-only scope — exported/CLI-accessible trackers
  may be inventoried too.)
- **One checkpoint, not interview, not one-shot**: propose→confirm→write
  balances safety and speed for large backlogs. The proposal is the
  reviewable artifact: milestone list plus **every** item with its target
  status — no sampling, the human must be able to veto any single mapping.
  (For huge backlogs the skill may write the proposal to a file rather
  than chat, but it is always complete.)
- **History**: done→done cards keeps throughput history on the board;
  git-derived dates beat stamping everything with migration day;
  provenance lines make every card auditable back to its source.
- **Originals are read-only, cleanup is a report**: the skill never edits,
  moves, or deletes legacy files. Instead it writes `.gello/migration.md`
  listing everything now obsolete — the user decides about removal.
  (Rejected: archive-move by the skill.)
- **Clean-repo gate**: migration creates many files; a clean working tree
  means the whole run is one reviewable, revertable diff. Dirty tree →
  warn and do nothing.
- **Concept folding is in**: a legacy vision/spec doc may be synthesized
  into `.gello/concept.md`, original untouched.
- **`in-progress` is excluded from migration** — WIP is claimed by whoever
  actually works, not inherited from stale plans; also respects WIP
  limits.
- **Delivery via c032 installer** (hence `depends: [c032]`): the user
  creates an empty board in the app first, which installs the skills; the
  onboarding skill fills the board. No pre-board bootstrap mode needed.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Delivered as `ONBOARD_SKILL` in src/lib/skills.ts, registered in
  `ALL_SKILLS` so the c032 installer ships it alongside discuss (same
  managed-marker / install-decision machinery, same one-time SkillPrompt).
  App install loop now iterates all skills.
- The template is the deliverable — it encodes every acceptance criterion as
  instructions to the agent: clean-tree pre-flight gate, format-agnostic
  inventory, complete propose→confirm-before-write checkpoint, mapping rules
  (structure→milestones, done→done, active→ready, ambiguous→inbox backlog,
  never in-progress), git-derived dates + provenance Log lines, sources
  read-only, concept folding, and a final `.gello/migration.md` obsolete-file
  report whose cleanup is the human's call. Embeds the board/frontmatter
  schema so it works with no gello mention in CLAUDE.md.
- Tests: onboard skill has its marker, byte-for-byte round-trip, embeds the
  key invariants; ALL_SKILLS distinct folders. (5 new; 283 total.)
- Flagged: the migration *flow* is instructional text for the agent, verified
  structurally (marker + invariant presence), not executed here.

## Log

- 2026-07-17 status → ready (app)
- 2026-07-17 onboard skill template + registered in installer, 5 tests, status → review
