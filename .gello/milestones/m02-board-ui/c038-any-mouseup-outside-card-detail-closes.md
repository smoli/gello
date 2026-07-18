---
id: c038
title: Any mouseup outside card detail closes
status: done
type: issue
created: 2026-07-16
updated: 2026-07-16
milestone: m02
---

When editing a card detail and using the mouse to, e.g. select the whole title it might happen, that the mouse travels outside the card edit dialog. Releasing the mousebutton then closes the dialog

## Notes

- Cause: DOM `click` fires on the common ancestor of mousedown and mouseup
  targets — a selection started inside the dialog and released outside
  lands a click on the backdrop.
- Fix: backdrop close requires the press to have *started* on the backdrop
  (mousedown target tracked in a ref) and the click to land there.
  Press-outside-release-outside still closes.

## Log

- 2026-07-16 reported (Stephan)
- 2026-07-17 reproducing test red → fix → 180/180 green, status → review
