---
id: i0029
title: Triage to an epic writes to legacy milestones/ path
status: in-progress
type: issue
epic: e06
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T14:28:00
---

## What

Bug: triaging a card to an epic writes it under the **legacy**
`milestones/<folder>/` path instead of the migrated `epics/<folder>/`.

Repro (how i0028 got misplaced): create an issue in the UI → move it to
`discuss` → pick an epic ("Epic model") from the picker. The card lands at
`.gello/milestones/e06-epics/…` and a stray `milestones/e06-epics/` folder is
created, instead of `.gello/epics/e06-epics/`.

Root cause: the triage destination is still hardcoded to `milestones/`:

- [board-actions.ts:249](src/lib/board-actions.ts:249) —
  `target.epicId === null ? "cards" : ` `` `milestones/${target.folder}` ``
  (carries a "legacy `milestones/` until migration" comment)
- [App.tsx:836](src/App.tsx:836) — optimistic
  `newPath = … ` `` `milestones/${folder}/${base}` ``

Both are the pre-migration path. The board migrated to `epics/` (c0080) but
these two write paths were never switched.

Fix: write to `epics/<folder>/` in both places. The loader already reads both
`epics/` and legacy `milestones/` (c0076 compat), so cards land in the right
folder and group correctly.

## Acceptance criteria

- [ ] Reproducing test (fails before fix): triaging a card to an epic yields
      a path under `epics/<folder>/`, not `milestones/<folder>/`
- [ ] Both the persisted write (`triageCard`) and the optimistic model update
      (`handleTriage`) use `epics/<folder>/`, kept in sync
- [ ] Asset-link depth stays correct (epic folder = depth 2 → `../../assets/`)
- [ ] Standalone (`cards/`) triage and other behaviour unchanged
- [ ] Cleanup: the misplaced `milestones/e06-epics/i0028-*.md` is moved to
      `epics/e06-epics/`; the stray `milestones/e06-epics/` folder is gone;
      dogfood load test green

## Discussion

- **Interim path never updated**: the triage-to-epic code carried a "legacy
  `milestones/` until migration" placeholder; the migration (c0080) landed
  but this write path wasn't switched to `epics/`.
- **Two spots in sync**: the persisted write and the optimistic update both
  build the path — fix both or the UI and disk disagree.
- **Do first**: this breaks correct epic assignment for every triage, and it
  produced the i0028 mislocation — tackle before the epic-creation work
  ([[i0028]]).
- **Open**: none — cause and fix identified.

## Log

- 2026-07-18 recorded (agent): triage-to-epic writes to legacy
  `milestones/<folder>/`; fix = switch both write paths to `epics/<folder>/`
  + relocate the misplaced i0028
- 2026-07-18 status → ready (app)
