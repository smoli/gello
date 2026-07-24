---
id: c0138
title: Multi project activity view.
status: discuss
created: 2026-07-24
updated: 2026-07-24
status-changed: 2026-07-24T21:58:32
epic: e02
---

## What

A cross-project mode in the app: one screen aggregating the **ready /
in-progress / review** cards of several projects at once, so you can watch and
act on work spanning multiple repos — the "companions running on gello *and*
popexel" case — without switching windows.

- **Pick the projects** to include, from the known/recent list; the view loads
  each one's board.
- **Three columns** — ready, in-progress, review — with **live updates** as
  cards move (each selected project's board is watched).
- **Coloured by project.** Each card carries its source project's colour,
  assignable in the view and persisted to that project's `board.yaml` — so the
  colour is the project's identity and travels with the repo, like `tag_colors`.
- **Accept work by drop.** A dedicated drop area sets a review card to `done`
  in *its own* project. No cross-project done column — accepting is a
  deliberate drop, not a pile.

**It is an action surface, not a passive monitor** (human's call). It shows
what needs *you* across projects — review cards to accept, and companion
questions to answer — and lets you act without opening that project's window:

- A card with a parked question shows the **needs-input badge** (read from its
  own `awaiting: input` marker, c0100) and is **answerable inline**.
- Clicking a card **opens its detail**, scoped to its project.

**Board-derived only.** The view reads each project's `.gello/` board, not its
`.companion/state.json`. So it does not show live companion run-state (who is
running, the c0109 activity line) — the needs-input badge is board-derived, so
answering works without it, and passive run churn you are not acting on is left
out.

**Cards are keyed by `(project, id)`.** Ids are per-board, so two projects both
have a `c001`; the aggregate must disambiguate by project, everywhere — keys,
colours, and every write.

## Acceptance criteria

- [ ] A mode presents ready / in-progress / review columns aggregating the
      cards of all selected projects
- [ ] Projects are chosen from the known/recent list; adding or removing one
      updates the view without a manual reload
- [ ] Each selected project's board is watched; a card moving in any project
      updates the view live
- [ ] Cards are keyed by project + id, so same-id cards from different projects
      never collide
- [ ] Each card shows its source project's colour; the colour is assignable in
      the view and written to that project's `board.yaml` (surgical edit)
- [ ] Dropping a review card on the done area sets it `done` in its own project,
      stamping `status-changed`
- [ ] A card with `awaiting: input` shows the needs-input badge and can be
      answered inline; the answer writes to that card's project
- [ ] Opening a card shows its detail scoped to its project
- [ ] The view reads no `.companion/state.json` — it is board-only
- [ ] Every cross-project write (done, answer, colour) goes through the same
      atomic write + conflict rebase as a single-project edit, against the
      owning project's root

## Discussion

- **Action surface, board-only** (human's call): card positions + the things
  needing you (review, parked questions), not live companion activity. The
  needs-input badge comes from the card's own marker (c0100), so answering
  cross-project needs no companion-state reads. Rejected: surfacing run-state /
  activity lines (per-project `state.json` reads for churn you are not acting
  on).
- **A mode in the main app** (human's call): no new-window plumbing. Accepted
  cost — `App.tsx` assumes one root, one watcher, one board throughout, so this
  mode must generalise loading and watching to *N* boards. Rejected: a separate
  window (cleaner isolation, its own lifecycle, second-monitor friendly, but
  more to build).
- **Three columns + a done drop** (carded): watch the flow that matters and
  accept work by a deliberate drop, so the view never fills with every
  project's done pile.
- **Per-project colour in `board.yaml`** (carded): the colour is the project's
  identity, so it belongs with the repo (like `tag_colors`), consistent for
  anyone who opens it — not an app-local setting.
- **`(project, id)` keying**: the one correctness trap — per-board ids collide
  across projects, so the aggregate disambiguates by project in state, in the
  colour map, and in every write path.
- **Open**: how many projects to watch and by what mechanism (N Rust watchers
  vs. a poll) and its cost; the `board.yaml` colour key name and an auto-default
  when unset; whether a project with no running companion is still shown (yes —
  it is board-based); whether `done` cards ever appear (only transiently, as the
  drop's feedback).

## Log

- 2026-07-24 status → discuss (app)
- 2026-07-24 discussed (human): a cross-project ready/in-progress/review view as
  a mode in the main app; board-derived (no companion state), coloured per
  project from board.yaml; accept review→done by drop, answer parked questions
  inline, open a card's detail — all scoped to the owning project; cards keyed
  by (project, id).
