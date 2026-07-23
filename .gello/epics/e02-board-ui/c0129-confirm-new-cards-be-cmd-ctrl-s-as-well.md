---
id: c0129
title: Confirm new Cards be CMD/CTRL+S as well
status: review
created: 2026-07-23
updated: 2026-07-23
status-changed: 2026-07-23T07:03:19
epic: e02
---

Right now. New cards are confirmed via CMD+ENTER, edited cards with CMD+S, that can be confusing, especially now as the editors look so similar.

## Acceptance criteria

- [x] Cmd/Ctrl+S confirms a new-card draft, from the title or the body
- [x] Cmd/Ctrl+Enter still confirms too — the new binding is added, not a swap
- [x] Cmd/Ctrl+S prevents the browser's save-page default
- [x] An empty title still blocks the submit, same as before
- [x] It works in every capture mode (idea/issue/epic) and report-issue,
      since they share `CaptureForm`

## Notes

- One binding added to `CaptureForm`'s existing form-level key handler, next
  to the c0064 Cmd/Ctrl+Enter one — both now call the same `submit()`, which
  keeps the i0016 single-submit latch and the empty-title guard. Cmd+Enter is
  kept, not replaced: the card says "as well".
- Deliberately mirrors the edit editor: `CardDetail`'s `editorKeyDown` saves
  on `s` + meta/ctrl with no IME-composition guard, so this matches it (unlike
  Enter, `s` is not an IME commit key).
- `preventDefault` is load-bearing here — without it Cmd+S opens the browser's
  save-page dialog over the app.

## Log

- 2026-07-23 status → ready (app)
- 2026-07-23 status → in-progress (agent)
- 2026-07-23 Cmd/Ctrl+S now also confirms a capture draft, alongside
  Cmd+Enter; mirrors the edit editor's save — 5 tests
- 2026-07-23 status → review (agent)
