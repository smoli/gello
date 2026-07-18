---
id: i0017
title: On Windows, custom header is not working
status: done
type: issue
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T20:43:23
epic: e02
---

Window has still its frame

## What

Bug (dogfooding): on Windows the window still shows its native OS frame — the
custom frameless header (c0059) only took effect on macOS.

Root cause: c0059 shipped the macOS half only. `tauri.conf.json` sets
`titleBarStyle: "Overlay"` (a macOS-only property) but never
`decorations: false`, and the [TitleBar](src/components/TitleBar.tsx) has no
window controls. On Windows/Linux, `titleBarStyle` is a no-op and decorations
stay on, so the native frame remains. c0059's plan for those platforms —
`decorations: false` + custom-drawn min/max/close — was never built.

This card delivers that missing half **for Windows/Linux only**: fully
frameless there with our own window controls. **macOS is left exactly as it
is today** (native traffic lights + overlay title bar) — no macOS changes in
this card.

Because `decorations: false` also removes the OS close/minimize/maximize
buttons, custom controls are mandatory on Windows/Linux — you couldn't
otherwise close the window from the UI.

## Acceptance criteria

- [ ] On Windows/Linux the window has no native OS frame; the board
      background reaches all edges
- [x] macOS is untouched: same native traffic lights + overlay title bar as
      today; no config or TitleBar change affects the macOS build
- [x] `decorations: false` is applied to Windows/Linux only (not macOS,
      which would lose its traffic lights)
- [x] The TitleBar renders custom minimize / maximize-restore / close
      controls, shown only on Windows/Linux, in the OS-conventional (right)
      position; not rendered on macOS
- [ ] Each control works: minimize, maximize↔restore (with correct toggle
      state/icon), close
- [ ] The window is resizable from all edges with decorations off, and the
      drag region still moves it (double-click maximizes/restores)
- [x] Controls stay clickable (not swallowed by `data-tauri-drag-region`) and
      legible over an arbitrary background image (c047)

## Discussion

- **Completes c0059's cross-platform chrome**: not a regression in isolation
  — the Windows/Linux path was specified but unimplemented. Confirmed:
  config has `titleBarStyle: Overlay` but no `decorations: false`, and
  TitleBar has no controls.
- **macOS untouched, work is Windows/Linux-only** (user directive): keep the
  current macOS chrome exactly (native traffic lights + overlay). Apply
  `decorations: false` and render the custom controls only on Windows/Linux
  — a global `decorations: false` would strip macOS's traffic lights, so the
  setting is applied per-OS (Rust `setup` detecting the platform, or
  platform-specific config), and the controls are gated to non-macOS.
- **Custom controls are mandatory, not optional**: `decorations: false`
  removes the OS buttons, so min/max/close must be drawn or the window can't
  be controlled from the UI. Maximize needs live toggle state (maximize vs.
  restore icon).
- **Edge-resize with decorations off**: frameless windows lose OS resize
  borders; verify Tauri's resize affordance is on (or add resize handles) so
  the window stays resizable.
- **Pairs with [[i0018]]** (Windows title path bug) — both are Windows
  fallout from c0059; verify together on Windows. **Intersects [[c019]]**
  (packaging) for per-OS build/verification.
- **Verification**: the human has a Windows box — frameless behavior and the
  custom controls are verified manually there. jsdom/Vitest covers the
  platform-gated control *rendering*; the real window behavior is checked on
  the Windows machine.
- **Open**: exact control styling (match Windows caption buttons vs. a neutral
  gello style); whether Linux is verified now or treated same-as-Windows on
  trust.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): root-caused — c0059 shipped macOS only
  (titleBarStyle Overlay, no decorations:false, no controls); this card
  builds the Windows/Linux frameless chrome + custom min/max/close
- 2026-07-17 refined (human): macOS stays as-is; frameless + custom controls
  are Windows/Linux only
- 2026-07-17 triaged (human): status → ready
- 2026-07-17 status → done (app)

## Notes

- Implemented: Rust `setup` calls `set_decorations(false)` gated to non-macOS
  (compile-checked both paths); a `WindowControls` component (min / max↔restore
  / close) rendered by TitleBar only when `!isMacOS()`, at the right; the
  traffic-light inset is now macOS-only. Window API calls go through guarded
  helpers in `window.ts`; capabilities gained minimize/toggle-maximize/close/
  is-maximized.
- Unit tests cover the platform-gated rendering, the maximize↔restore toggle,
  and that each control invokes its window action. macOS layout unchanged
  (verified visually).
- **Pending human verification on Windows/Linux** (jsdom can't drive the real
  window): no native frame + background to all edges; the controls actually
  minimize/maximize/close; and edge-resize + drag/double-click-maximize with
  decorations off. These three acceptance criteria stay unchecked until then.

## Log

- 2026-07-17 fixed (agent): built the Windows/Linux frameless chrome —
  decorations:false (non-macOS, in Rust setup) + custom WindowControls gated
  on !isMacOS(); macOS left as-is. Runtime behavior pending Windows verify.
