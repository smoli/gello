---
id: c0133
title: New skill turning concept into epics
status: discuss
created: 2026-07-24
updated: 2026-07-24
status-changed: 2026-07-24T07:19:43
epic: e06
---

## What

A new gello skill for greenfield: turn a project **concept** into the
**epic-level structure**. It is the missing first link in gello's own stated
workflow (concept.md §1: "a written concept that gets broken down into epics
and implementation steps") and the greenfield sibling of `gello-onboard`:

- new project: **concept → [this skill] → epics → `gello-plan` → cards**
- existing project: task org → `gello-onboard` → board

**Stops at epics** (human's call). It creates `epics/eNN-slug/epic.md` with a
Goal and a Definition of done, and hands off to `gello-plan` to break each epic
into cards. This keeps the ecosystem's one-skill-one-job split (onboard and
plan are already separate) and lets the human review the epic shape before any
card exists.

**Two-phase, human-gated**, exactly like `gello-plan`: propose the epic
breakdown, change nothing until the human approves, then create the `epic.md`
files. Nothing on disk before approval.

**Flow:**

1. **Ensure a board.** Scaffold `.gello/` (board.yaml + the CLAUDE.md snippet)
   if it is missing, so the skill works from an empty repo. This must match the
   app's canonical scaffold — `BOARD_YAML` / `claudeMdContent` in
   `src/lib/scaffold.ts` — not a hand-rolled variant.
2. **Get the concept.** Read `.gello/concept.md` if it exists (gello's
   authoritative spec). If not, interview the human — goal, users, scope, the
   shape of the thing — and write `concept.md` first. Either way a concept.md
   is left behind as the source of truth.
3. **Propose the epics.** Draft the breakdown: a handful of epics, each a
   one-line goal, and how they sequence. Present for approval; write nothing.
4. **Create on approval.** One `epics/eNN-slug/epic.md` per approved epic —
   sequential `eNN` ids (never reused), `status: backlog`, a `## Goal` and a
   `## Definition of done` that trace back to concept.md sections.
5. **Hand off.** Create no cards; point the human at `gello-plan` per epic.

**Registration.** To be offered by the app's skill installer, the skill must
join `ALL_SKILLS` in `src/lib/skills.ts` (alongside DISCUSS / ONBOARD / PLAN),
and its SKILL.md authored under `.claude/skills/`. Both the file and the
embedded template must carry the `gello-managed` footer like the others.

## Acceptance criteria

- [ ] A new skill exists under `.claude/skills/` with a SKILL.md whose
      description triggers on starting a project / a concept / turning a concept
      into epics
- [ ] It is registered in `ALL_SKILLS` (`src/lib/skills.ts`) so the app's skill
      installer offers it, with the `gello-managed` footer
- [ ] Two-phase and human-gated: it proposes the epic list and creates nothing
      until the human approves
- [ ] It reads `.gello/concept.md` when present and does not overwrite it
- [ ] With no concept.md, it interviews the human and writes one before
      decomposing
- [ ] It scaffolds `.gello/` (board.yaml + CLAUDE.md) when absent, matching the
      output of `src/lib/scaffold.ts`
- [ ] On approval it creates one `epics/eNN-slug/epic.md` per epic, each with a
      unique sequential `eNN` id, `status: backlog`, a `## Goal`, and a
      `## Definition of done`
- [ ] Existing epic ids are never reused or renumbered
- [ ] It creates no cards and ends by pointing at `gello-plan`
- [ ] Each epic's Goal / Definition of done traces to the concept

## Discussion

- **Epics only, hand off to gello-plan** (human's call): mirrors onboard/plan
  staying separate; the human reviews the epic shape before cards exist.
  Rejected: going all the way to cards (a big, less-reviewable step that
  duplicates gello-plan), and an in-skill "plan each now" orchestration.
- **Concept: read, else interview** (human's call): serves both "I wrote a
  concept" and "I have an idea", and always leaves a concept.md as the spec.
  Rejected: consume-only (useless from a bare idea) and always-interview
  (discards a concept the user already wrote).
- **Scaffold if missing** (human's call): a true from-scratch new-project flow.
  Accepted cost — it duplicates the app's scaffold, so it must be kept in sync
  with `scaffold.ts` rather than forking its own board.yaml/CLAUDE.md.
- **Fits the skill ecosystem**: same two-phase human-gated shape as gello-plan,
  same `epics/eNN-slug/epic.md` contract gello-plan already reads, so the two
  compose without either knowing the other's internals.
- **Open**: the skill's name (`gello-epics` / `gello-structure` / `gello-scope`
  / `gello-concept` — it is a `gello-<verb/noun>` slot like its siblings);
  whether epics should carry an explicit inter-epic order or dependency, or
  leave sequencing to prose and card `depends` later; how to keep the scaffold
  step from drifting from `scaffold.ts` (reference the constants vs. accept a
  periodic re-sync); whether the app's "initialize board" flow should offer to
  run this skill next.

## Log

- 2026-07-24 status → discuss (app)
- 2026-07-24 discussed (human): a greenfield skill concept → epics, stopping at
  epics and handing off to gello-plan; reads concept.md or interviews to write
  one; scaffolds `.gello/` if missing (matching scaffold.ts); two-phase
  human-gated; must be registered in ALL_SKILLS to be installable.
