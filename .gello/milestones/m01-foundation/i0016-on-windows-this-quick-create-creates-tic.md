---
id: i0016
title: On Windows this quick create creates ticekt twice
status: review
priority: normal
type: issue
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T19:59:12
milestone: m01
---

## What

Bug (dogfooding): submitting the quick-capture form with **Cmd/Ctrl+Enter
while focus is in the Title field** creates the card twice — two board
entries with the same id and identical content.

Root cause: two keydown handlers both fire for that one keypress.
`CaptureForm` has a Title-input `onKeyDown` that calls `submit()` on *any*
Enter ([CaptureForm.tsx:57](src/components/CaptureForm.tsx:57)), and a
form-level `onKeyDown` that calls `submit()` on mod+Enter
([CaptureForm.tsx:43](src/components/CaptureForm.tsx:43)). A Cmd/Ctrl+Enter
in the Title field satisfies both, so `submit()` → `onCreate()` runs twice
synchronously. Both calls read the same (not-yet-updated) board model, so
`createCard` allocates the same next id and writes the same path, and the
optimistic update appends the card twice. macOS happens not to surface it in
normal use, but the double-handler is platform-independent.

## Acceptance criteria

- [x] Reproducing test (fails before the fix): Cmd/Ctrl+Enter in the Title
      field calls `onCreate`/`onSubmit` exactly once
- [x] Cmd/Ctrl+Enter submits once from the Title field, the Details
      textarea, and elsewhere in the form
- [x] Plain Enter in the Title field still submits once; plain Enter in the
      Details textarea still inserts a newline (does not submit) — c0064
      behavior preserved
- [x] Clicking "Add" once creates exactly one card
- [x] Guard is defensive: a submit is idempotent per form instance (a second
      near-simultaneous invocation cannot create a second card), and IME
      composition Enter (`isComposing`/keyCode 229) does not submit

## Discussion

- **One keypress, two handlers**: the Title input handler fires on bare
  `Enter`, the form handler on mod+`Enter`; mod+Enter in the title hits
  both. Fix: the input handler submits only on a *plain* Enter
  (`!metaKey && !ctrlKey`), leaving mod+Enter to the single form-level
  handler — collapses the double without touching c0064's Cmd/Ctrl+Enter
  contract.
- **Defense in depth**: also make `submit()` idempotent per form instance (a
  "submitted" latch reset on open) and ignore IME-composition Enter — so no
  future duplicate-handler or fast-key path can double-create. This is the
  real safety net; the handler fix removes the specific trigger.
- **Why "same id, same content"**: both synchronous `onCreate` calls close
  over the same board model, so id allocation and the optimistic append both
  run against pre-update state — same id, duplicated entry. Confirms it's a
  double-*invoke*, not an id-allocation bug.
- **Not truly Windows-only**: the code path doubles on any platform; Windows
  is just where it was hit. The fix and its test are platform-agnostic
  (jsdom reproduces it).
- **Open**: none — cause identified, fix scoped.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): root-caused to CaptureForm's double
  Enter-handler (Title input + form-level both fire on Cmd/Ctrl+Enter);
  fix = plain-Enter-only in the input + idempotent submit latch
- 2026-07-17 triaged (human): status → ready
- 2026-07-17 fixed (agent): title input submits on plain Enter only (mod+Enter
  handled once at form level) + idempotent per-instance submit latch + IME
  guard. Reproducing test + idempotency/IME tests added.
