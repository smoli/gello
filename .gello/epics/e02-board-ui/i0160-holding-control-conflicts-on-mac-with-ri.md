---
id: i0160
title: "Holding control conflicts on Mac with „right click\""
status: review
type: issue
ref: c0146
epic: e02
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T15:31:02
usage-tokens: 9330
usage-cost: 1.186941
---

The switcher's `Ctrl+Tab` gesture requires holding Control, which on macOS is the right-click modifier — so while the overlay is open, clicking an entry is a secondary click. How do you want it fixed?

- [ ] **Drop `Ctrl+Tab` on macOS** — only `Cmd+`` ` `` opens the switcher there (Control is then never held by gello). `Ctrl+Tab` keeps working on Linux/Windows. *(my recommendation — smallest change, mac-native)*
- [x] **Keep both bindings, make the overlay Control-click-safe** — a Control-click on an entry picks it instead of raising a context menu, and the native menu is suppressed inside the overlay.
- [ ] **Both** — drop `Ctrl+Tab` on macOS *and* harden the overlay against context-menu clicks.
- [ ] Something else (say what)

## What

The c0146 project switcher binds `Ctrl+Tab` on every platform and commits on the
Control keyup, so the whole gesture is "hold Control". On macOS Control is the
secondary-click modifier: while it is held, every mouse click is a right click.
So with the switcher open a user cannot click an entry to pick it — the click
comes through as a context-menu event instead (the click-to-commit fallback from
c0146), and the webview's own menu can pop up over the overlay.

macOS already has the second binding `Cmd+`` ` ``, which has no such conflict.

Decided (human): keep both bindings and make the overlay Control-click-safe.

## Acceptance criteria

- [x] A secondary click (macOS Control-click) on a switcher entry picks that
      entry, exactly as a plain click does
- [x] No context menu — the app's or the webview's — opens for a click anywhere
      in the switcher overlay
- [x] A secondary click on the overlay outside an entry commits nothing
- [x] `Ctrl+Tab` and `Cmd+`` ` `` both keep working as before

## Notes

- Current wiring (`App.tsx` ~line 424): `opensSwitcher` = `Ctrl+Tab`, plus
  `Cmd+`` ` `` on mac; `cyclesSwitcher` = Tab / `` ` ``; commit on `keyup` of
  Control (or Meta on mac). Entries commit through `onClick` in
  `ProjectSwitcher.tsx`.
- Nothing else in the app uses Ctrl as a chord modifier on mac, and the board's
  own context menus (`onContextMenu`) are the intended Control-click target — so
  the conflict is confined to the switcher gesture.
- The fix is two handlers in `ProjectSwitcher.tsx`: an entry's `onContextMenu`
  picks it (and preventDefaults), the overlay's preventDefaults only. Any
  secondary click on an entry picks — the platform is not sniffed, since a
  context menu means nothing in the switcher either way.
- The overlay is `position: fixed; inset: 0`, so its handler covers every click
  made while the switcher is up, not just the ones on the panel.
- Not exercisable headless: whether WKWebView delivers the `contextmenu` for a
  Control-click to the button (tests fire it directly). If it fires the trailing
  `click` after the overlay unmounts, the target is a detached node, so nothing
  underneath should see a stray click — worth a look in the real app.

## Log

- 2026-08-08 status → ready (app)
- 2026-08-08 status → in-progress (agent)
- 2026-08-08 asked how to resolve the conflict; human chose: keep both bindings,
  make the overlay Control-click-safe
- 2026-08-08 secondary click in the switcher picks the entry, native menu
  suppressed across the overlay — 3 tests (2 component, 1 App)
- 2026-08-08 status → review (agent)
