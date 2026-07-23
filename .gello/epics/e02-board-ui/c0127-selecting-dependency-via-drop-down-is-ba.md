---
id: c0127
title: Selecting dependency via drop down is bad UX
status: done
ref: c0124
epic: e02
created: 2026-07-23
updated: 2026-07-23
status-changed: 2026-07-23T06:59:12
depends: []
---

With many cards in the project using just a drop down is not feasible.

The nicest thing would be a tokenized input field. The user types and gets a list of suggestions based on the partial entry they did. Selecting from the suggestions adds the card as a token to the list.
Similar to the recipients fields in E-Mail composers

## Acceptance criteria

- [x] The add control is a text input, not a dropdown of every card
- [x] Typing filters the candidate cards by id or title
- [x] No suggestions show until something is typed
- [x] Picking a suggestion (click or Enter) adds it as a dependency
- [x] Arrow keys move the highlight; Enter takes the highlighted one
- [x] The input clears after an add, ready for the next
- [x] A pick that would close a cycle is still refused with the chain (c0124)
- [x] Escape drops the suggestions without closing the card detail
- [x] The already-added dependencies stay as the removable tokens (c0124)

## Notes

- The dependency chips from c0124 were already the tokens; this card only
  swaps the *add* control — the `<select>` of every candidate for a
  type-to-filter input with a suggestion list. Purely `CardDetail` and its
  CSS; `dependencyOptions` still arrives from `App` unchanged, and the
  filtering is client-side.
- Suggestions are capped at 8. With a big board even a filtered list can be
  long, and the answer to "too many to pick from" is another keystroke, not a
  scrollbar.
- Cycle handling is untouched from c0124: loop-closing candidates still appear
  and are refused with the named chain on pick. The alternative — hiding them —
  was already rejected there for teaching nothing.
- Escape is the same nested-guard pattern as the capture form: it clears the
  query and `stopPropagation`s so the window-level Escape (c023) does not close
  the whole detail. An empty input lets Escape through, so it still closes.
- Each suggestion is a `role="option"` button inside a `role="listbox"`, so it
  is one focusable, clickable, named element — the ARIA combobox shape, and
  what the tests drive.

## Log

- 2026-07-23 status → in-progress (agent)
- 2026-07-23 replaced the dependency dropdown with a type-to-filter tokenized
  input (arrow/Enter/Escape, cycle refusal kept) — 8 tests, reworked the two
  c0124 select tests to match
- 2026-07-23 status → review (agent)
- 2026-07-23 status → done (app)
