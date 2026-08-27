---
id: c0174
title: Autoselect filtered Epic
status: review
created: 2026-08-27
updated: 2026-08-27
status-changed: 2026-08-27T12:05:54
epic: e03
---

If the board is filtered on one epic, assign this epic automatically to a newly created card or issue

## Acceptance criteria

- [x] `createCard` takes an optional epic target (`{ folder, epicId }`): the
      card is written to `epics/<folder>/<id>-<slug>.md` with `epic: <epicId>`
      in its frontmatter.
- [x] Without a target, `createCard` is unchanged — `cards/<id>-<slug>.md`, no
      `epic:` line.
- [x] The board reports its active epic filter to the host, on mount and on
      every change (a project switch remounts the board, i0116, and must reset
      it).
- [x] Quick capture (⌘N task, ⌘I issue) with the board filtered to one epic
      creates the card in that epic; on "All epics" or "No epic" it creates a
      standalone card in `cards/`.
- [x] An image pasted into such a draft is linked at the epic folder's depth
      (`../../assets/…`).
- [x] The capture form names the epic the card will land in, so the assignment
      is not silent.

## Notes

- A card born with an epic already skips the c0090 epic prompt on leaving the
  inbox column — `promptsForExit` only asks for epic-less cards, so that comes
  for free.
- An epic folder with no `epic.md` has no epic id. The target then carries
  `epicId: null`: the card lands in the folder (which is what decides epic
  membership) and gets no `epic:` line, mirroring `triageCard`.
- Report-issue and follow-up cards are untouched — they already inherit their
  source card's epic and folder.
- The board owns the filter and the host owns creation, so `Board` reports the
  filter up (`onEpicFilterChange`, fired from an effect so a remount reports
  too) and `App` mirrors it. `withNewEpicCard` is the optimistic model update,
  the epic counterpart of `withNewStandaloneCard`.
- The capture overlay covers the toolbar, so the filter cannot change while a
  draft with a pasted image is open — the reserved link depth stays right.
- `companion/control.test.ts` and `companion/runner.test.ts` fail on this
  machine before this change too (6 failures on a clean tree); everything else
  is green, including typecheck and lint.

## Log

- 2026-08-27 status → ready (app)
- 2026-08-27 status → in-progress (agent)
- 2026-08-27 capture files a card under the epic filter's epic; tests green
- 2026-08-27 status → review (agent)
