---
id: c0059
title: Make the Window frameless
status: review
priority: normal
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:56:36
milestone: m02
order: 10
---

With custom header, so the background can bleed up to the top.

OS aligned window gadgets.

## What

Drop the OS title bar so the board background image (c047) bleeds to the top
edge, and host a custom draggable top bar. The bar shows the window title as
**`gello: <foldername> (<branch>)`** — the project folder containing
`.gello/` and the current git branch (branch omitted when not a git repo).
The search field stays in the toolbar below — it does **not** move up. The
top bar is window chrome: title + drag region + (on Windows/Linux) the
window controls.

This **removes the status bar** (c0057): folder and branch move into the
title, so the bottom bar is redundant. The status bar's card-count tally is
dropped for a cleaner UI (not relocated).

Per platform:

- **macOS**: `titleBarStyle: "Overlay"` + `hiddenTitle` — native traffic
  lights stay top-left, board background renders behind them. The top bar is
  a `data-tauri-drag-region` with the `gello: <folder> (<branch>)` title;
  content is inset from the left so it clears the traffic-light zone.
- **Windows/Linux**: `decorations: false` with a **custom-drawn** window
  chrome — our own minimize/maximize/close cluster in the OS-conventional
  position (right), plus the title, over the bled-through background.

## Acceptance criteria

- [x] The board background reaches the top window edge — no OS title bar
      band above it
- [ ] A draggable top bar moves the window; the window controls (where
      custom-drawn) remain clickable, not swallowed by the drag region
- [x] The top bar shows the title `gello: <foldername> (<branch>)`, where
      `<foldername>` is the basename of the directory containing `.gello/`
      and `<branch>` is the live git branch (omitted, with no empty parens,
      when not a git repo); the search field stays in the toolbar below
- [x] The branch in the title updates live when `.git/HEAD` changes
      (reuses c0057's git-branch watcher before the status bar is removed)
- [x] The bottom status bar is removed (`StatusBar` component + wiring);
      no card-count tally remains
- [x] macOS: native traffic lights are visible, correctly positioned, and
      not overlapped by the title (left inset respected)
- [ ] Windows/Linux: custom-drawn minimize/maximize/close in the
      OS-conventional (right) position work correctly (incl. maximize
      toggle state), over the bled-through background
- [ ] Double-click on the drag region maximizes/zooms (OS convention);
      window stays resizable from all edges with decorations off
- [ ] Readability: title/controls stay legible over an arbitrary background
      image (scrim/backdrop as needed), consistent with c047's translucent
      columns

## Discussion

- **Keep native controls, don't redraw them**: matches "OS aligned window
  gadgets" — native traffic lights / caption buttons behave correctly
  (hover, right-click menus, snap) for free. (Rejected: fully custom
  per-OS controls — reimplements native behavior and drifts from OS
  conventions.)
- **Search field stays in the toolbar**: the top bar is pure window chrome
  (title + drag region + controls), not a home for board controls — keeps
  window-drag and board-controls from fighting for the same clicks, and the
  title bar stays uncluttered.
- **Cross-platform tension, resolved as hybrid**: "native controls" +
  "bleed to top" is natively supported on macOS (Overlay title bar) but
  **not** on Windows/Linux, where bleed-to-top forces `decorations: false`.
  Decision: macOS keeps native traffic lights; Windows/Linux get
  **custom-drawn** min/max/close in the OS-conventional (right) position.
  Not native there, but the honest cost of bleeding content to the top.
- **Drag-region correctness is the subtle part**: `data-tauri-drag-region`
  makes children draggable too, so inputs/buttons must explicitly opt out,
  and the traffic-light corner must be reserved so a drag there doesn't
  fight the OS.
- **Supersedes [[c0057]] (status bar)**: c0057 is in review with a working
  bottom bar (folder + branch + card counts). Folding folder + branch into
  the title makes it redundant, and dropping it — counts included — is the
  "cleaner UI" the user asked for. The git-branch command + `.git/HEAD`
  watcher c0057 built are kept and reused by the title; only the bottom-bar
  UI is removed. (Whether c0057 lands as done-then-removed or is reverted
  in this card is the human's triage call.)
- **Intersects [[c047]]** (background image) — the whole point is the image
  reaching the top — and **[[c019]]** (packaging) which owns per-OS build
  concerns; the Windows/Linux control work may belong there.
- **Open**: exact macOS traffic-light inset (default vs. custom position);
  whether the Windows/Linux custom-chrome work lands in this card or defers
  to [[c019]] (packaging) while those platforms keep a normal frame in the
  interim.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): frameless with native-overlay controls
  (macOS traffic lights kept), search field moved into a draggable top bar,
  all platforms — flagged the Windows/Linux native-vs-bleed tension.
- 2026-07-17 revised (agent): search field stays in toolbar; title is
  `gello: <folder> (<branch>)`; Windows/Linux get custom-drawn chrome;
  removes the c0057 status bar (folder+branch in title, counts dropped).
- 2026-07-17 status → ready (app)

## Notes

- **Scope landed: macOS.** `titleBarStyle: "Overlay"` + `hiddenTitle` in
  tauri.conf drops the title band and keeps native traffic lights floating
  over the bled-through background. Custom `TitleBar` (absolute, 30px,
  `data-tauri-drag-region`, 78px left inset for the lights, scrim for
  legibility) shows `gello: <folder> (<branch>)` via pure `windowTitle`.
  Board content padded down 30px; background reaches the top edge.
- Branch is live: reuses c0057's git-branch command + `.git/HEAD` watcher
  (ungated now that it feeds the title).
- **c0057 status bar removed**: StatusBar component/CSS/test deleted, App
  wiring dropped, `cardCounts` removed (counts intentionally not relocated).
- **Windows/Linux custom chrome DEFERRED to [[c019]]** (packaging), per the
  card's open question — those platforms keep a normal frame until then.
  The three Win/Linux/double-click-zoom criteria are intentionally left
  unchecked and belong to c019; flagged here rather than faked.
- macOS visual criteria (traffic-light inset, readability scrim) verified in
  `tauri dev`; drag-region/resize behavior needs a human eyeball on the
  running window.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 macOS frameless overlay + TitleBar; status bar removed;
  Win/Linux chrome deferred to c019; 5 tests, status → review
