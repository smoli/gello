---
id: c0123
title: Show on the card front when a card is blocked by a dependency
status: in-progress
epic: e02
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T18:49:09
---

## What

A card in `ready` whose `depends` are not all `done` will never be picked up —
but the board gives no hint of it. It sits in `ready` looking exactly like a
card that is about to run, and nothing happens. Surface that state on the card
front.

This is a **board fact, not a companion fact**: the app can derive it from the
model alone (`card.depends` + the statuses of those cards), so it works with no
companion running at all. The companion's own held-back reasons are terminal-
only and one-shot, so nothing else in the UI can tell you.

Real case (popexel, 2026-07-22): `c0073` sat in `ready` with
`depends: [c0072]` while c0072 was still in `review`. The companion correctly
declined to dispatch it, said so once in its log, and thereafter looked simply
broken.

**A third variant of the status line.** The card front already has a line below
the title shared by the c0109 activity line and the c0117 pickup countdown —
c0117's own comment says it "shares the activity line's look so the two live
elements read as one system". Blocked joins them as a third treatment, reading
e.g. `waiting on c0072`, rather than crowding the badge row (which already
holds archived, needs-input, type and the c0118 follow-up trigger).

**It names the blockers, and they are clickable** — only the dependencies that
are *not* done, each linking through to that card, matching the companion's own
log wording and the existing `ref` back-link. The click must
`stopPropagation`: the whole card front is a click target *and* a drag handle,
so without it the blocked card's own detail opens behind the navigation — the
lesson c0118 already learned with its follow-up trigger.

**Shown in `ready` and `in-progress`.** In `ready` a blocked card is the
silent-failure case this card exists for. In `in-progress` it is an anomaly
worth seeing — a dependency reopened after dispatch, or a card picked up by
hand — rather than a normal state. Elsewhere an unfinished dependency is just
the plan, so nothing is shown.

**Precedence on the shared line:** a live activity line wins, then the pickup
countdown, then blocked. The line should carry the most time-sensitive thing;
blocked is persistent and reappears the moment nothing live is happening. (This
matters only in `in-progress`, where a running card can also be blocked.)

**Not the WIP-limit hold.** "Held at the WIP limit" is a companion fact — the
app cannot know the runner's limit — so it is out of scope here. It would need
the companion's held-back reasons published into its state file, which is a
separate gap.

## Acceptance criteria

- [x] A card in `ready` or `in-progress` whose `depends` are not all `done`
      shows a blocked line below its title
- [x] The line names only the unfinished dependencies; satisfied ones are not
      listed
- [x] Each named id is clickable and opens that card
- [x] Clicking an id does not also open the blocked card's own detail behind it
- [x] The line renders as a third treatment of the existing status-line slot,
      alongside the activity line and the pickup countdown
- [x] When a live activity line or a pickup countdown is present, that takes the
      slot; blocked shows when neither is
- [x] A dependency id that matches no card on the board is shown as missing,
      not merely unfinished
- [x] Cards in any other status show nothing, whatever their dependencies
- [x] It is derived from the board model alone and renders with no companion
      running
- [x] The line keeps its single-line truncation when several dependencies are
      unfinished

## Discussion

- **Third variant of the shared status line** (human's call): the slot and its
  visual language already exist, the states are mutually exclusive in the
  common case, and the badge row is already carrying four possible occupants.
  Rejected: a "blocked" badge (cannot name what is blocking) and a muted
  whole-card treatment (says nothing about why, and fights the board
  background).
- **`ready` + `in-progress`** (human's call): blocking costs you a run in
  `ready`, and in `in-progress` it signals something irregular. Rejected:
  ready-only (misses the anomaly) and every status (most of the board would
  carry the marker as ordinary noise).
- **Named and clickable** (human's call): the point of the card is to answer
  "why is nothing happening", which a bare "blocked" does not.
- **Precedence activity → countdown → blocked** (my call, flag if wrong): the
  shared line shows the most immediate state, and blocked returns as soon as
  nothing live is happening. The alternative — blocked always winning, so the
  anomaly cannot be masked by a running agent — is the reasonable other choice.
- **A board fact, not a companion fact**: derived from `card.depends` plus
  those cards' statuses, so it works with no companion at all. This matters
  because `depends` is currently parsed and then never used anywhere in the app
  (see [[c0124]]) — the only consumer in the project is the companion's
  `planDispatch`.
- **Open**: whether the companion's WIP-limit hold should later share this line
  once those reasons are published into the state file.

## Log

- 2026-07-22 raised after the popexel c0073 case: a ready card held by an
  unfinished dependency is invisible on the board.
- 2026-07-22 discussed (human): a third treatment of the existing status line
  naming the unfinished dependencies, each clickable; shown in `ready` and
  `in-progress`; the WIP-limit hold stays out of scope as a companion fact.
- 2026-07-22 status → ready (app)
- 2026-07-22 status → in-progress (agent)
