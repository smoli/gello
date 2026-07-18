---
id: c0074
title: Epics
status: discuss
created: 2026-07-17
updated: 2026-07-18
status-changed: 2026-07-18T00:03:06
epic: e05
---

We could Introduce an Epic concept. The user create and epic and there’s a skill similar to gello-discuss but additionally with emphasis on a broader implementation plan with several steps probably with dependencies

## What

**Rename the milestone concept to `epic`** — same single-container model, new
name, end to end. A milestone already *is* an epic: a folder that owns its
member cards, a container `.md` with a goal / definition of done, and a
`depends` graph sequencing the work. The name is the only thing wrong —
"milestone" implies a deadline or a temporal sequence these never had, while
"epic" carries the right meaning (a large effort broken into steps). No new
card type; the epic *is* the folder container.

So an epic owns the cards in its folder (the implementable steps), holds the
overall plan + goal/DoD in `epic.md` (was `milestone.md`), and orders its
children with the existing `depends` field.

**Not every card belongs to an epic.** Bugs and small one-off changes
shouldn't be forced under a larger effort. Epic-less cards live flat in
`.gello/cards/`. So the tree has three homes:

- `.gello/inbox/` — unprocessed capture (unchanged)
- `.gello/epics/eNN-name/` — cards that belong to an epic
- `.gello/cards/` — standalone cards (no epic): bugs, small changes

**Folder location is epic membership** — a card in an epic folder belongs to
that epic; a card in `cards/` has none and carries no `epic:` field. Triage
therefore has two exits: inbox → an epic, or inbox → `cards/` (triaged, no
epic). On the board a standalone card renders normally in its status column
with no epic label, and the epic filter gains a **"No epic"** option to
isolate them.

**Tags stay too, as a separate axis.** This does not remove label-grouping —
tags (c0058) remain an independent, additive, cross-cutting grouping: a card
lives in at most one epic (or none) and may carry several tags. This
re-scopes [[c0058]] from "replace milestones with tags" to "add tags
alongside epics"; that card must be updated.

**Full rename, including ids:**

- field `milestone:` → `epic:`
- container `milestone.md` → `epic.md`
- folders `m01-foundation/` → `e01-foundation/`, ids `m01` → `e01`
- board "milestone filter" → "epic filter"; card labels
- concept.md §4 and CLAUDE.md vocabulary
- migrate this repo's own board; the dogfood load test stays green

**Migrating existing boards.** This changes the on-disk format, so every
existing `.gello/` board (not just this repo's) needs converting — there are
already real projects using the milestone format. On open, the app **detects**
an old-format board (a `milestones/` tree, `milestone.md`, `milestone:`
fields, or `m*` ids) and **gates** it: instead of rendering the board it shows
a "needs migration" prompt. There is **no read-alias** — an un-migrated board
does not open as a board. One click runs the migration: rename
`milestones/`→`epics/` and each `mNN-name`→`eNN-name`, `milestone.md`→`epic.md`,
rewrite `milestone:`→`epic:` (remapping ids `mNN`→`eNN` consistently across
folder names and field values), and fix relative asset links. It writes the
new tree before removing the old, so an interrupted migration is recoverable,
never a half-deleted board. This is the same logic that migrates this repo's
own board — the dogfood board is just the first customer.

Plus an **epic-planning skill** (sibling to gello-discuss): interview the
human about the epic, draft a stepwise implementation plan + dependency graph
into `epic.md`, and — only on explicit approval — create the child cards in
the epic's folder with `depends` wired between them. Two-phase
(plan → approve → create), mirroring discuss's write-then-triage.

## Acceptance criteria

- [ ] Schema/parser: `epic:` replaces `milestone:`, `epic.md` replaces
      `milestone.md`; the loader groups by epic exactly as it grouped by
      milestone (behaviour unchanged, names changed)
- [ ] Folders and ids use the epic naming (`e01-…`); id allocation uses the
      `e` namespace
- [ ] Board filter and card labels read "epic"; grouping/filtering behaviour
      is unchanged
- [ ] Epic membership is optional: the loader reads standalone cards from a
      flat `.gello/cards/` (no `epic:` field, no epic label on the board),
      alongside `inbox/` and the epic folders
- [ ] Triage can send an inbox card to `.gello/cards/` (no epic) as well as
      into an epic folder; asset links resolve at the `cards/` depth
- [ ] The epic filter includes a "No epic" option that isolates the
      standalone cards
- [ ] concept.md §4 and CLAUDE.md updated to epic vocabulary; no stray
      "milestone" left in code/docs except an intentional migration alias
- [ ] The app detects an old milestone-format board on open and gates it with
      a "needs migration" prompt (an un-migrated board does not render as a
      board — no read-alias)
- [ ] One-click migration converts a board in place: `milestones/`→`epics/`,
      `mNN-name`→`eNN-name`, `milestone.md`→`epic.md`, `milestone:`→`epic:`
      with ids remapped `mNN`→`eNN` consistently, asset links rewritten
- [ ] Migration is recoverable: the new tree is written before the old is
      removed, so an interruption never leaves a half-deleted board
- [ ] This repo's own board migrates via the same path; dogfood load test
      green, zero invalid files afterward
- [ ] Tags (c0058) reframed as additive — this card does not remove
      label-grouping; the two axes coexist
- [ ] Epic-planning skill: interview → plan + dependency graph into
      `epic.md` → on explicit approval, create child cards in the epic folder
      with `depends` wired; gello-managed, installed via the c032 installer
- [ ] (Stretch) filtering to an epic surfaces its `epic.md` plan and a
      child-progress rollup (N of M done)

## Discussion

- **Rename over a new card type**: the milestone container already carries
  everything an epic needs — folder, charter `.md`, member cards, `depends`.
  Renaming reuses all of it and drops the "third card type" idea entirely.
  (Rejected: a `type: epic` parent card — redundant with the container.)
- **Settles the milestone ambiguity**: this is the same problem [[c0058]]
  raised ("milestone is weird — it's a domain, not a sequence"), resolved by
  giving the container its true name rather than deleting it.
- **Epics and tags are both kept, different axes**: epic = the one
  container/effort a card is a step of (single-membership, folder); tag =
  cross-cutting labels a card may have many of. Because both survive, c0058
  changes from a milestone-*replacement* to a tags-*addition*.
- **Epic membership is optional** (flat `.gello/cards/`): forcing every card
  under an epic would make bugs and one-liners into ceremony. Folder location
  is the source of truth (epic folder = belongs, `cards/` = standalone), so
  standalones need no `epic:` field — mirroring how a milestone card's
  membership is its folder today. `cards/` sits at inbox depth, so its asset
  links use `../assets/` (one less level than epic cards).
- **Full rename incl. ids**: chosen for a clean end state over a half-rename
  that leaves `m01` legacy; the migration is mechanical (folder + field +
  file renames, asset-link rewrites).
- **Planning skill reuses the container**: the plan lives in `epic.md`,
  children are ordinary cards in the epic folder sequenced by `depends` — the
  skill is gello-discuss with a breakdown + dependency emphasis and a
  create-children step.
- **Must-migrate, no alias** (user's call): an old-format board is gated on
  open until converted, rather than the parser reading `milestone:` forever.
  Keeps the code single-format (only `epic`), at the cost of a one-time
  migration step — acceptable because it's one click and the format is the
  same shape, just renamed. Recoverability (write-new-before-remove-old) is
  the safety net for a rewrite of the user's own files.
- **Migration is app-hosted and shared**: detection + conversion live in the
  app and run for any board on open; this repo's board is just the first to
  go through it. (Distinct from [[c029]] onboard, which imports a *foreign*
  task format — this converts gello's own prior format.)
- **This card is itself epic-sized** (rename migration + existing-board
  migration + docs + board relabel + the planning skill). Break it down — and
  dogfood it as the *first* epic.
- **Open**: keep the container's `status`/`due` fields or drop them (epics
  aren't time-boxed either); the id prefix (`e`); whether the board gains an
  epic detail/plan view or stays filter-only; whether a non-git board should
  get an explicit backup before the in-place migration; the skill's name
  (`gello-plan` / `gello-epic`).

## Log

- 2026-07-18 status → discuss (app)
- 2026-07-18 discussed (agent): epic = `type: epic` parent card with
  `epic:`-linked children + a `depends` graph; computed child rollup/progress
  in detail; orthogonal to tags; two-phase planning skill (plan → approve →
  create) installed via c032. Flagged as epic-sized; dogfood it as the first
  epic.
- 2026-07-18 reframed (human): don't add a card type — **rename milestone →
  epic** (full rename incl. ids/files/fields, reusing the container infra).
  Keep tags too as a separate cross-cutting axis, so c0058 becomes
  tags-additive, not a milestone replacement. Planning skill unchanged.
- 2026-07-18 added (human): existing-board migration — the app detects an
  old milestone-format board on open and gates it until a one-click,
  recoverable in-place conversion runs (no read-alias). Same logic migrates
  this repo's board.
- 2026-07-18 added (human): epic membership is optional — standalone cards
  (bugs, small changes) live flat in `.gello/cards/` with no epic; board
  shows them normally + a "No epic" filter option.
- 2026-07-18 planned out as an epic (dry run of the planning skill): broken
  into `m06-epics` (milestone.md charter + c0076–c0082 with depends wired).
  Created as a milestone for now, since epics don't exist yet — the first
  thing m06 builds is what would have held it.
