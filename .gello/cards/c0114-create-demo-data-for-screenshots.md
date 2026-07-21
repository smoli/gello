---
id: c0114
title: Create demo data for screenshots
status: discuss
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T22:18:28
---

## What

A hand-authored demo board in a gitignored `demo/` subfolder (same pattern as
`sandbox/`), rich enough that every gello feature can be screenshotted from it.
The fiction: **a web community for leasing out firewood** — believable card
titles, epics, and bodies, so screenshots read as a real project rather than
lorem ipsum.

**Make it a git repo.** `git init` + one commit, so the title bar shows
`gello - <folder> (main)` — without it the branch is missing from every shot,
and the c0083 dirty indicator can't be demonstrated either.

**Feature coverage** the board must exercise:

- **board.yaml** — the full default column set (so no column is empty), a
  `wip_limits` entry, a `background` (a warm gradient suits the theme), and
  `tag_colors` overrides so the chips look deliberate
- **Epics** — three or so (marketplace / payments / logistics), each with an
  `epic.md`, plus **standalone** cards in `cards/` so both shapes appear
- **Types** — tasks and at least one `issue` carrying `ref:` (provenance)
- **Tags** across several cards, **`depends`** on a blocked card, manual
  **`order`** in backlog/ready, and varied **`status-changed`** so the
  in-progress/review/done columns sort sensibly
- **Card bodies** — headings, task-list checkboxes, a code block, a table, a
  link; at least one card with an image in `assets/` for the c012 thumbnail
- **A parked card** — `awaiting: input` plus a question block, showing the
  needs-input badge and the c0102 question rendering
- **Edge surfaces** — an **archived** card and a **malformed** card, so the
  needs-attention lane and "gello never hides your cards" are screenshotable

**Companion visuals** come from a hand-written `.gello/.companion/state.json`
(status `running`, a run with `activity` and `usage`, plus `ready`/`waiting`)
which renders the title-bar indicator, the runs popover, and a card activity
line. Note the constraint: `isCompanionLive` treats a state file older than
`STALE_MS` (30s) as dead, so **bump `updated` to now immediately before
shooting** or the indicator disappears and the activity line dims.

## Acceptance criteria

- [ ] `demo/` exists with a `.gello` board and is listed in `.gitignore`
- [ ] `demo/` is a git repo with at least one commit, so the title bar shows a
      branch
- [ ] `board.yaml` sets the full column list, a WIP limit, a background, and
      tag colour overrides
- [ ] At least three epics with `epic.md`, plus standalone cards; **every**
      column has at least one card
- [ ] The board includes an `issue` with `ref:`, a card with `depends:`, tags
      across several cards, and manual `order` in backlog/ready
- [ ] At least one card renders a thumbnail from an image in `assets/`
- [ ] At least one card body shows headings, checkboxes, a code block and a
      table
- [ ] One card is parked with `awaiting: input` and a question block (badge +
      question rendering visible)
- [ ] One archived card and one malformed card exist (needs-attention lane
      renders)
- [ ] A `.companion/state.json` produces the runner indicator, the runs popover
      and a card activity line when `updated` is current

## Discussion

- **Hand-authored, gitignored** (human's call). Tradeoff accepted: the board
  can't be regenerated and will silently rot whenever the card format changes —
  fine for a one-off screenshot asset. Rejected: a committed generator script
  (reproducible, but over-engineering here) and committing the demo board
  itself.
- **Static companion state, 30s window** (human's call): `updated` must be
  refreshed right before a shoot. Rejected a timestamp-refresh loop.
- **Edge surfaces included** (human's call): the malformed and archived cards
  make the needs-attention behaviour screenshotable, which is a real selling
  point rather than only shooting the happy path.
- **git init is load-bearing**, not incidental — the branch in the title bar
  and the dirty-worktree dot both depend on it.
- **Open**: the demo project's folder name (it shows in every screenshot —
  something like `holzhof` or `woodshare` reads better than `demo`); where the
  thumbnail images come from (a couple of real firewood photos beat a
  placeholder block); whether to also stage an uncommitted change at shoot time
  to demonstrate the dirty indicator.

## Log

- 2026-07-21 status → discuss (app)
- 2026-07-21 discussed (human): hand-authored gitignored `demo/` board (no
  generator), firewood-community fiction, git-initialised so the branch shows;
  static `.companion/state.json` accepting the 30s staleness window; edge
  surfaces (malformed + archived cards) included alongside the polished path.
