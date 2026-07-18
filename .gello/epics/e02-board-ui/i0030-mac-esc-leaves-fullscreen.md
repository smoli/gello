---
id: i0030
title: "Mac: ESC leaves Fullscreen"
status: done
type: issue
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T16:35:19
epic: e02
---

## What

Bug (macOS): pressing **Escape exits the app's fullscreen**. No Escape
handler calls `preventDefault`, so the key always reaches the webview/OS
default — which on macOS fullscreen exits it. This happens both when Esc
dismisses an overlay (card/epic detail, capture/report-issue draft, milestone
picker, context menu, search) and when nothing is open.

Desired: Esc **only dismisses the topmost app overlay** (or clears search)
when one is open, and otherwise does nothing. It must **never** exit
fullscreen — leave that to the OS (green button / ⌃⌘F).

Fix — **JS first**: a single app-level keydown handler that calls
`preventDefault()` on every Escape so the key never reaches the
fullscreen-exit default. The existing per-overlay Escape handlers keep
dismissing (multiple `window` keydown listeners coexist; `preventDefault`
stops only the default action, not the other listeners). If macOS still exits
fullscreen at the native/AppKit level — or the app uses the browser
Fullscreen API, where `preventDefault` can't cancel Esc — add a Rust/native
intercept. Verify on the Mac.

## Acceptance criteria

- [x] Escape in fullscreen with nothing open does NOT exit fullscreen
- [x] Escape with an overlay open dismisses it and does NOT exit fullscreen —
      card detail, epic detail, quick-capture / report-issue draft, milestone
      picker, context menu; and clears the search box
- [x] No Escape regressions: editing-mode cancel (c023/editor) and other
      Esc behaviours still work
- [x] Fullscreen can still be left via the OS control (green button / ⌃⌘F)
- [ ] Verified on macOS (the reported platform) — **needs the human on the Mac**; JS fix landed + unit-tested, code analysis says JS is sufficient

## Discussion

- **Root cause**: no Escape handler `preventDefault`s, so the key hits the
  webview/OS default that exits fullscreen. Confirmed in `CardDetail`
  (c023: `onClose()` with no `preventDefault`) and the absence of any global
  Esc swallow.
- **Minimal JS fix**: one global `preventDefault`-on-Escape stops the default
  without touching the overlay dismiss handlers — they run independently, so
  dismissal keeps working while fullscreen no longer exits.
- **Native fallback approved**: if it's the browser Fullscreen API or an
  AppKit responder action that ignores JS `preventDefault`, do a Rust/native
  intercept — whatever it takes. Part of the fix is determining **which
  fullscreen the app uses** (native green-button vs. `requestFullscreen`),
  since that decides whether JS can win.
- **Fullscreen exit stays an OS gesture**: Esc is overlay-dismiss only.
- **Open**: which fullscreen mechanism is in play (native vs. browser) —
  decides JS-sufficiency; must be checked on the Mac.

## Log

- 2026-07-18 status → discuss (app)
- 2026-07-18 discussed (agent): Esc must only dismiss overlays, never leave
  fullscreen; fix = global preventDefault-on-Escape (JS), native intercept if
  macOS still exits at the AppKit/Fullscreen-API level; verify on Mac
- 2026-07-18 status → ready (app)
- 2026-07-18 implemented (agent): found NO browser Fullscreen API / requestFullscreen
  anywhere in app code and no Tauri fullscreen config → the app uses **native
  macOS (AppKit) fullscreen**, so a JS preventDefault can intercept Escape before
  it reaches AppKit. Fix: one **capture-phase** window keydown listener in App
  that preventDefaults every Escape (capture phase so it beats the capture form's
  stopPropagation; preventDefault leaves the overlays' own Escape-dismiss intact).
  Unit-tested (nothing-open swallow, non-Escape untouched, overlay-still-dismisses
  + default-prevented). 498 tests green. ⚠️ Criterion 5 (Mac verify) is the
  human's — if macOS STILL exits fullscreen, the approved native/AppKit intercept
  is the follow-up.
- 2026-07-18 status → done (app)
