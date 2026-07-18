---
id: m06
title: Epic model
status: backlog
---

## Goal

Rename gello's **milestone** concept to **epic** (the same single-container
folder model, with the right name and connotation — a large effort broken
into steps, not a deadline), keep **tags** as a separate cross-cutting axis,
allow **epic-less** cards (`.gello/cards/`) for bugs and small changes, and
add an **epic-planning skill** that breaks an epic down into dependent child
cards. Includes a migration for existing boards.

This milestone is itself the dry-run output of that planning skill, applied
to [[c0074]] — gello's first epic, dogfooded.

## Definition of done

- Milestone → epic rename complete across schema, board UI, and docs; no
  stray "milestone" except an intentional migration alias.
- Existing milestone-format boards (including this repo's) migrate cleanly;
  dogfood load test green, zero invalid files.
- Epic-less cards work end to end (flat `.gello/cards/`, "No epic" filter).
- The epic-planning skill exists and is installed by the c032 installer.

## Plan (steps + dependencies)

1. **c0076 — Epic data model** (root). Schema + loader rename; standalone
   cards. Everything depends on this.
2. **c0077 — Epic board UI** (← c0076). Filter, labels, "No epic".
3. **c0078 — Triage to epic or standalone** (← c0076).
4. **c0079 — Board migration engine** (← c0076). Detect + gate + convert.
5. **c0080 — Migrate this repo's board** (← c0079). Dogfood cutover.
6. **c0081 — Docs** (← c0076). concept.md §4 + CLAUDE.md.
7. **c0082 — Epic-planning skill** (← c0076). The gello-discuss sibling.

## Source

Broken down from the c0074 discussion (milestone→epic rename, both
migrations, optional epic membership, tags coexistence, planning skill).
Open questions from c0074 (epic `status`/`due`, `e` id prefix, epic
detail/plan view, non-git backup, skill name) carry into the relevant
child cards.
