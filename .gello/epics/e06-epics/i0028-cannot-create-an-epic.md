---
id: i0028
title: Cannot create an epic
status: done
type: issue
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T18:00:03
epic: e06
---

## What

The epic model (e06) can load, group, filter, and triage into epics — but
there's no way to **create** one in the app. Close that gap with several
entry points, all producing a new `epics/eNN-<slug>/epic.md`, then opening
the epic's detail view.

**Entry points** (all funnel to one create path):

- **Quick-capture epic mode** — the capture form gains an **epic** mode
  alongside task/issue. **⌘/Ctrl+E** opens the form pre-selected as an epic
  (⌘N stays a task, ⌘I an issue). Epic mode captures **title + goal**.
- **"+ New epic"** in the epic filter dropdown (toolbar).
- **Create-on-triage** — when triaging a card to an epic, offer "+ New epic"
  to create one inline and assign the card to it.

**Creating an epic**:

- allocates the next **e-namespace** id and scaffolds
  `epics/eNN-<slug>/epic.md` with `id`, `title`, `status: backlog`, a
  `## Goal` (from the captured goal), and an empty `## Definition of done`,
  written atomically (folder + file).
- then **opens the epic's detail view** — a goal / definition-of-done editor
  plus a rollup of the epic's child cards (empty at first).

## Acceptance criteria

- [x] Quick-capture has an epic mode; **⌘/Ctrl+E** opens the form in epic
      mode (⌘N task, ⌘I issue unchanged); epic mode captures title + goal
- [x] "+ New epic" in the epic filter creates an epic
- [x] Triaging a card into an epic offers "+ New epic" to create-and-assign
      inline
- [x] Creating an epic scaffolds `epics/eNN-<slug>/epic.md` with a fresh
      e-id, title, `status: backlog`, `## Goal` from input, empty
      `## Definition of done`; folder + file written atomically
- [x] After creation the new epic's detail view opens (goal/DoD editor +
      child rollup)
- [x] The new epic appears in the epic filter and as a board group
- [x] e-id allocation never reuses or renumbers existing ids

## Discussion

- **Multiple entry points, one create path**: quick-capture (⌘E toggle), the
  epic-filter "+ New epic", and create-on-triage all call the same scaffold.
  ⌘E completes the capture-shortcut set (⌘N task, ⌘I issue, ⌘E epic).
- **Title + goal at birth**: an epic is a larger effort, worth a one-line
  goal when created (unlike a quick card). Goal → `## Goal`; DoD left empty
  to fill in the detail view.
- **Opens the epic detail view — the heavy sub-piece**: "create → land in the
  epic" needs an **epic detail view** (goal/DoD editor + child rollup), which
  is the c0074 open item and doesn't exist yet. That view is substantial
  (CardDetail-sized). Recommend splitting it into its own card that this one
  depends on, rather than smuggling a full detail view into a creation issue —
  see Open.
- **Creation ≠ planning**: making the epic is separate from breaking it into
  cards (the gello-plan skill). Create now, plan later.
- **Part of e06**: this closes the "can't make one" gap in the epic model.
- **Open**: build the epic detail view here or as a separate dependency card
  (recommended: separate — it's large); the non-mac shortcut (Ctrl+E);
  whether create-on-triage ships in this card or is deferred.

## Log

- 2026-07-18 status → discuss (app)
- 2026-07-18 discussed (agent): epic creation via quick-capture epic mode
  (⌘E) + epic-filter "+ New epic" + create-on-triage; captures title + goal;
  scaffolds epics/eNN/epic.md and opens the epic detail view. Flagged the
  detail view as a large sub-piece to split out.
- 2026-07-18 status → ready (app)
- 2026-07-18 scope resolved (human): the epic **detail view** is split into its
  own card (c0084); i0028 opens a **minimal** epic view (goal/DoD editor stub +
  child rollup). Create-on-triage **is** included here. ⌘E for epic capture;
  non-mac uses Ctrl+E.
- 2026-07-18 implemented (agent): createEpic/newEpicRaw/withNewEpic (core);
  QuickCapture epic mode + ⌘/Ctrl+E + "+ New epic" button; epic-filter
  "+ New epic"; create-on-triage via MilestonePicker; minimal EpicDetail
  (goal/DoD stub + child rollup) opens on create. Full editor split to
  [[c0084]]. 496 tests, typecheck, lint green. Criterion 5 opens the MINIMAL
  view per the scope call — the full detail view is c0084.
- 2026-07-18 status → done (app)
