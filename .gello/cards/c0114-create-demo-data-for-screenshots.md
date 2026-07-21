---
id: c0114
title: Create demo data for screenshots
status: in-progress
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T22:31:24
---

## What

A hand-authored demo board at **`demo/holzhof/`** (with `demo/` gitignored,
same pattern as `sandbox/`), rich enough that every gello feature can be
screenshotted from it. The title bar renders the folder name, so shots read
`gello - holzhof (main)`.

**The fiction: Holzhof, a web community for leasing out firewood** — played
**tongue in cheek**. The premise is quietly absurd (you lease firewood, then
burn it; it is not coming back), and the cards should treat that with complete
professional sincerity. Sample flavour:

- *Seller onboarding: verify the applicant owns an actual tree*
- *Log quality rating (1–5 splinters)*
- *Deposit hold for logs not returned*
- *Refund policy for partially combusted goods*
- *Wheelbarrow-radius delivery search*
- *Stacking-pattern preview: Holzmiete vs. Holzhaufen*
- issue: *Users keep burning the inventory* (`ref:` the marketplace card)
- tags: `kindling`, `seasoned`, `hardwood`, `splinter`, `urgent`

**Calibrate the humour**: deadpan-plausible at a glance, funny on a second
read. These end up in marketing screenshots, so titles must look like real
backlog items — the joke lives in the *domain*, never in silly formatting or
punchlines. If a shot reads as unserious, it undercuts gello.

**Make it a git repo.** `git init` + one commit inside `demo/holzhof/`, so the
title bar shows the branch — without it the branch is missing from every shot,
and the c0083 dirty indicator can't be demonstrated either.

**Feature coverage** the board must exercise:

- **board.yaml** — the full default column set (so no column is empty), a
  `wip_limits` entry, a `background` (a warm gradient suits the theme), and
  `tag_colors` overrides so the chips look deliberate
- **Epics** — three or so (Marketplace / Payments & Deposits / Logistics &
  Stacking), each with an `epic.md`, plus **standalone** cards in `cards/` so
  both shapes appear
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

- [x] `demo/holzhof/` exists with a `.gello` board, and `demo/` is listed in
      `.gitignore`
- [x] `demo/holzhof/` is a git repo with at least one commit, so the title bar
      shows `gello - holzhof (main)`
- [x] Card titles are deadpan-plausible — they read as a real backlog at a
      glance, with the humour in the domain rather than the formatting
- [x] `board.yaml` sets the full column list, a WIP limit, a background, and
      tag colour overrides
- [x] At least three epics with `epic.md`, plus standalone cards; **every**
      column has at least one card
- [x] The board includes an `issue` with `ref:`, a card with `depends:`, tags
      across several cards, and manual `order` in backlog/ready
- [x] At least one card renders a thumbnail from an image in `assets/`
- [x] At least one card body shows headings, checkboxes, a code block and a
      table
- [x] One card is parked with `awaiting: input` and a question block (badge +
      question rendering visible)
- [x] One archived card and one malformed card exist (needs-attention lane
      renders)
- [x] A `.companion/state.json` produces the runner indicator, the runs popover
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
- **Named `holzhof`, played tongue in cheek** (human's call). The name shows in
  every screenshot, so it carries the fiction for free. The humour is
  deliberately dry: the cards stay professionally sincere about an absurd
  premise, because these are marketing shots — an obviously joking board would
  make gello itself look unserious.
- **Open**: where the thumbnail images come from (a couple of real firewood
  photos will beat a placeholder block); whether to stage an uncommitted change
  at shoot time to demonstrate the dirty indicator.

## Log

- 2026-07-21 status → discuss (app)
- 2026-07-21 discussed (human): hand-authored gitignored board (no generator),
  firewood-community fiction, git-initialised so the branch shows; static
  `.companion/state.json` accepting the 30s staleness window; edge surfaces
  (malformed + archived cards) included alongside the polished path.
- 2026-07-21 named **Holzhof** at `demo/holzhof/`, played tongue in cheek —
  deadpan-plausible titles, the joke in the domain not the formatting.
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
