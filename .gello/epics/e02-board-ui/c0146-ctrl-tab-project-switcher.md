---
id: c0146
title: ctrl+tab project switcher
status: ready
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T13:01:17
epic: e02
order: 40
---

## What

`Ctrl+Tab` (and `Cmd+`` ` `` on macOS) opens an **MRU project switcher** — the
Alt+Tab model — so you can flip between recently-opened projects without the
menu or folder picker. (The scheme is **MRU / most-recently-used**, as in
Alt+Tab and `Cmd+`` ` ``.)

**Behaviour:**

- An **overlay** lists recent projects by title (folder name): current on top,
  then the previously-visited, and so on — the existing `recent` list, which is
  already most-recent-first (capped at 8).
- **First Ctrl+Tab preselects the second entry** (the previous project), so a
  single Ctrl+Tab + release jumps straight back to your last project — the
  quick-toggle.
- With the modifier held, **Tab cycles down**, **Shift+Tab cycles up**, both
  wrapping around.
- **Releasing the modifier commits** — opens the selected project.
- **Ctrl+Esc aborts** — Escape while the modifier is held closes the switcher
  and stays on the current project. Abort takes precedence over commit: the
  modifier release that follows the Escape does **not** then open anything.
- The list is **frozen while the switcher is open** — cycling never reshuffles
  it. The chosen project re-fronts the recent list only *on commit*, so the
  next Ctrl+Tab toggles back to where you were.
- A recent entry whose board can't be found is shown **greyed**; committing to
  it **warns and does not switch**.

Reuses `recent` (the MRU list) and `openProject` (the existing switch, which
already re-fronts the list). Switching is app-view only: companions in other
projects are separate processes and keep running headless — unaffected.

## Acceptance criteria

- [ ] `Ctrl+Tab` opens an overlay listing recent projects by title, current on
      top, in MRU order
- [ ] On macOS `Cmd+`` ` `` opens the same switcher; `Ctrl+Tab` also works there
- [ ] The first `Ctrl+Tab` preselects the second entry (the previously-visited
      project)
- [ ] With the modifier held, `Tab` moves the selection down and `Shift+Tab` up,
      both wrapping
- [ ] The list does not reorder while the switcher is open
- [ ] Releasing the modifier opens the selected project
- [ ] `Ctrl+Esc` (Escape while the modifier is held) aborts — stays on the
      current project — and the modifier release that follows does not commit
- [ ] Committing re-fronts the chosen project in `recent`, so the next
      `Ctrl+Tab` toggles back
- [ ] An entry whose board is not found renders greyed; committing to it warns
      and does not switch
- [ ] With no other recent project, the switcher is a no-op (or shows only the
      current)
- [ ] The selection logic (MRU order, preselect-second, cycle, wrap) is a pure,
      unit-tested function separate from the key handling

## Discussion

- **MRU / Alt+Tab model**: the `recent` list already *is* the MRU order, so the
  overlay is just a view over it. The only real subtlety is snapshot-on-open +
  re-front-on-commit — which is what makes one Ctrl+Tab a quick-toggle to the
  last project.
- **Reverse cycle** (human's call): `Ctrl+Shift+Tab` up the list — standard and
  cheap, so overshooting isn't a full wrap away.
- **macOS binds both** (human's call): `Ctrl+Tab` everywhere plus `Cmd+`` ` ``
  for mac-native feel. `Cmd+`` ` `` normally cycles OS windows, but inside one
  app window it is free to repurpose. Rejected: `Ctrl+Tab`-only (unusual on
  mac) and `Cmd+`` ` ``-only (diverges from the single shortcut asked for).
- **Dead entries shown, warn on open** (human's call): transparency over
  auto-pruning — a moved/deleted repo stays visible (greyed) rather than
  silently vanishing, and committing to it warns instead of loading a blank
  board. Rejected: skip-and-prune.
- **Frozen while cycling** (decided, standard): a live-reordering list would
  reshuffle under the cursor mid-cycle.
- **Open — the load-bearing risk**: commit-on-release depends on reliably
  catching the modifier `keyup` in the Tauri webview across platforms, which
  can be finicky (a lost keyup would leave the overlay stuck). Likely needs a
  fallback — `Enter` commits, and the overlay closes if focus is lost — plus a
  decision on whether entries are also clickable.

## Log

- 2026-08-05 status → discuss (app)
- 2026-08-05 discussed (human): MRU (Alt+Tab) project switcher over the `recent`
  list; Ctrl+Tab + Cmd+` on macOS, Shift to reverse; first hit preselects the
  previous project; snapshot while cycling, re-front on commit; dead entries
  shown greyed and warn on open.
- 2026-08-05 added Ctrl+Esc to abort — takes precedence over commit, so the
  following modifier release opens nothing.
- 2026-08-05 status → ready (app)
