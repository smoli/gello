---
id: c023
title: close detail display by hitting esc
status: done
created: 2026-07-16
updated: 2026-07-16
milestone: m02
tags: [Card detail]
---

## What

Bug (found by dogfooding): Escape does not close the card detail in the real
app. The keydown handler sits on the dialog element, which only receives key
events while focus is inside it — after opening a card by click, focus stays
on the card front behind the dialog, so Escape goes nowhere. jsdom tests
missed it because they fire the event directly on the dialog element.

## Acceptance criteria

- [x] Escape closes the detail regardless of where focus is
- [x] Escape while editing the body still only cancels the edit (dialog stays open)
- [x] Escape in the quick-capture form does not close a detail behind it

## Notes

- Fix: window-level keydown listener while the dialog is mounted, suspended
  during body editing (the editor owns Escape = cancel). The dialog's own
  redundant keydown handler removed — it double-fired once the window
  listener existed (caught by the existing test).
- QuickCapture now stops Escape propagation so closing the capture form
  can't fall through and close a card detail behind it (App-level test).
- Reproducing test fires Escape on document.body — exactly the focus
  situation jsdom tests previously missed.

## Log

- 2026-07-16 captured via quick capture (Stephan), triaged to m02
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 reproducing test red → fix → 139/139 green, status → review

