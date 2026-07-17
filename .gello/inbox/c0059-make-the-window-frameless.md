---
id: c0059
title: Make the Window frameless
status: discuss
priority: normal
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T08:40:06
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
  a `data-tauri-drag-region` with the `gello: <folder>` title; content is
  inset from the left so it clears the traffic-light zone.
- **Windows/Linux**: `decorations: false` with a **custom-drawn** window
  chrome — our own minimize/maximize/close cluster in the OS-conventional
  position (right), plus the title, over the bled-through background.

## Acceptance criteria

- [ ] The board background reaches the top window edge — no OS title bar
      band above it
- [ ] A draggable top bar moves the window; the window controls (where
      custom-drawn) remain clickable, not swallowed by the drag region
- [ ] The top bar shows the title `gello: <foldername> (<branch>)`, where
      `<foldername>` is the basename of the directory containing `.gello/`
      and `<branch>` is the live git branch (omitted, with no empty parens,
      when not a git repo); the search field stays in the toolbar below
- [ ] The branch in the title updates live when `.git/HEAD` changes
      (reuses c0057's git-branch watcher before the status bar is removed)
- [ ] The bottom status bar is removed (`StatusBar` component + wiring);
      no card-count tally remains
- [ ] macOS: native traffic lights are visible, correctly positioned, and
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
- **Search field moves into the top bar**: reclaims the vertical space the
  old title bar took; the top bar isn't just dead chrome. Filters stay
  below so window-drag and board-controls don't fight for the same clicks.
- **Cross-platform tension (the key risk)**: "native controls" + "content
  bleeds to top" is natively supported on macOS (Overlay title bar) but
  **not** on Windows/Linux, where bleed-to-top means `decorations: false`
  and therefore custom-drawn min/max/close. So the honest resolution is
  hybrid: macOS keeps native traffic lights; Windows/Linux get a minimal
  custom control cluster positioned per-OS. Worth confirming this is
  acceptable, or scoping Windows/Linux to a later pass (they'd keep a
  normal frame until then).
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
  whether Windows/Linux land in this card or defer to c019; does the app
  title/board name appear anywhere once the OS title bar is gone.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): frameless with native-overlay controls
  (macOS traffic lights kept), search field moved into a draggable top bar,
  all platforms — flagged the Windows/Linux native-vs-bleed tension.
- 2026-07-17 revised (agent): search field stays in toolbar; title is
  `gello: <folder> (<branch>)`; Windows/Linux get custom-drawn chrome;
  removes the c0057 status bar (folder+branch in title, counts dropped).
