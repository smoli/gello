---
id: c0124
title: Show a card's dependencies in the card detail
status: discuss
epic: e02
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T18:21:00
---

## What

`depends` is **invisible in the app**. It is parsed into `Card.depends` and
then never rendered, never used in any component, and never read by anything in
`src/lib` — the only consumer in the whole project is the companion's
`planDispatch`. From the app's side it is a write-only field: you can only see
it by opening the raw Markdown.

Show a card's dependencies in the card detail, so the relationship is part of
the card rather than hidden in frontmatter.

The reverse direction matters as much as the forward one: gello already renders
provenance both ways (`ref` gives a child its back-link, and `openIssuesFor`
gives the parent its list), so dependencies showing only one way would be the
odd one out.

## Open questions (pre-discuss)

- **Both directions?** "Depends on: c0072" *and* "Blocked: c0073 is waiting on
  this" — the second is derived by scanning the board, like `openIssuesFor`.
- **How much per entry** — id only, or id + title + status, and is each entry
  clickable through to that card (as the `ref` back-link already is)?
- **Unfinished vs done** — visually distinguish dependencies that are still
  blocking from ones already satisfied?
- **Missing / archived dependency** — an id that resolves to nothing should say
  so rather than silently look unsatisfied.
- **Editing** — read-only display for now, or add/remove dependencies from the
  detail view? (Editing implies a picker and validation against cycles.)
- **Where** — near the epic/`ref` metadata at the top, or its own section?

## Log

- 2026-07-22 raised alongside [[c0123]]: dependencies drive companion dispatch
  but are not visible anywhere in the UI.
