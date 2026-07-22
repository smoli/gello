---
id: c0124
title: Show a card's dependencies in the card detail
status: review
epic: e02
created: 2026-07-22
updated: 2026-07-22
status-changed: 2026-07-22T19:32:10
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

**Two sections, matching the house style.** `CardDetail` already renders
related cards as a `card-backlinks` block — a `field-label` plus `card-link`
buttons reading `{id} — {title}` that open via `onOpenCardId` (used today by
"Open issues against this card" and "Follow-ups from this card"), and
`card-ref` already has a `(not found on this board)` fallback for an id that
resolves to nothing. Dependencies reuse all of it:

- **Depends on** — every entry in `depends`, with the ones not yet `done`
  visually distinguished from the satisfied ones. The detail view is where the
  full picture belongs; the card front (c0123) deliberately shows only what is
  still blocking.
- **Blocking** — cards whose `depends` include this one, derived by scanning
  the board exactly as `openIssuesFor` does, and hidden when empty like the
  existing sections. This is what tells you that finishing this card would
  release someone else.

**Editable from the detail** — add via a picker, remove per entry — so wiring
work no longer means hand-editing YAML. Two things this needs that do not
exist yet:

- **`depends` is not writable today.** `CardFieldChanges` covers
  `status | epic | title | tags | order | statusChanged | awaiting` only. It
  needs `depends` added — a small, precedented change, since `tags` is already
  a `string[]` written through `formatFlowList` (`[a, b]`), so the YAML shape
  and the surgical write path are identical.
- **Cycle detection is new** — there is no graph logic anywhere in the project.
  It is not pedantry: if c001 depends on c002 and c002 on c001, *both* cards
  are blocked forever and the companion skips them silently, permanently. That
  is the popexel c0073 failure mode with no way out.

**The Blocking list is read-only.** It is derived, so removing an entry there
would mean writing a *different* card's file. Dependencies are removed from the
card that owns them.

## Acceptance criteria

- [x] The detail shows a **Depends on** section listing every dependency as
      `{id} — {title}`, each opening that card
- [x] Dependencies that are not `done` are visually distinguished from
      satisfied ones
- [x] A dependency id matching no card on the board is shown as missing, in the
      style of the existing `ref` fallback
- [x] The detail shows a **Blocking** section listing cards whose `depends`
      include this card, hidden when there are none
- [x] Both sections use the existing `card-backlinks` / `card-link` pattern and
      navigate via `onOpenCardId`
- [x] A dependency can be added from the detail through a card picker
- [x] A dependency can be removed from the detail
- [x] `depends` is written through the surgical frontmatter path, leaving every
      untouched line byte-identical
- [x] A card cannot be made to depend on itself
- [x] Adding a dependency that would create a cycle is refused, and the reason
      is shown
- [x] The Blocking list is read-only — no control there writes another card
- [x] Editing dependencies writes only the edited card's file

## Discussion

- **Both directions** (human's call): every other relationship in gello renders
  both ways (`ref` back-link ↔ `openIssuesFor`, follow-ups ↔ parent), so a
  one-way dependency would be the odd one out — and the reverse view answers
  "who am I holding up?", which the forward one cannot.
- **All dependencies, unfinished distinguished** (human's call): the detail is
  the full picture — what this card rests on and how much of it is done —
  deliberately different from c0123's card front, which lists only blockers to
  stay on one line.
- **Editable** (human's call). Accepted cost: it is materially bigger than a
  display card, because it needs `depends` added to the writable field set and
  a cycle check that has no precedent in the codebase. Rejected: read-only for
  now, which would have kept the card small but left dependency wiring as a
  YAML-editing chore.
- **Cycles must be refused, not merely warned**: a dependency cycle deadlocks
  the companion silently and permanently — both cards sit in `ready`, neither
  is ever dispatched, and nothing on the board says why.
- **Reverse list read-only** (my call): it is derived state; letting it write
  would mean one card's detail silently modifying another card's file.
- **Open**: whether the picker should hide cards that would create a cycle up
  front, or let you pick and then explain the refusal (the second teaches the
  constraint but costs a failed attempt); whether epics should also show what
  their cards are blocked by.

## Notes

- Four functions in `board.ts` carry the whole thing, next to the c0123
  `blockersFor`: `dependenciesOf` (forward, resolved, card order),
  `blockingCards` (reverse, scanned like `openIssuesFor`), `dependencyCycle`,
  and `dependencyOptions`. `CardDetail` gets data, not the model — it decides
  nothing about the graph.
- `dependencyCycle(model, cardId, dependencyId)` returns the loop the new edge
  would close, so the refusal names it: `c0124 → c003 → c0124`. It walks each
  id once, which also means it terminates on a board that *already* contains a
  cycle (hand-edited YAML can produce one, and then this is the screen you
  would use to break it).
- The open question — hide loop-closing candidates or let them be picked and
  explain — resolved as: keep them in the picker and refuse with the chain.
  The acceptance criterion asks for a shown reason, and a silently short list
  teaches nothing. Self is the exception: it is not offered at all, though
  `dependencyCycle` still calls it a loop.
- Writing needed nothing new: `depends` joined `CardFieldChanges`, and
  `formatFlowList` already produced `[a, b]` for `tags`. Clearing the last
  dependency writes `depends: []`, matching what clearing tags does.
- The reverse list has no controls at all — an entry there lives in *another*
  card's file, and one card's detail must not write another's.

## Log

- 2026-07-22 raised alongside [[c0123]]: dependencies drive companion dispatch
  but are not visible anywhere in the UI.
- 2026-07-22 discussed (human): both directions (Depends on + derived
  Blocking), all dependencies listed with unfinished distinguished, and
  add/remove from the detail — which pulls in making `depends` writable and
  adding cycle detection.
- 2026-07-22 status → ready (app)
- 2026-07-22 status → in-progress (agent)
- 2026-07-22 both sections, add/remove, cycle refusal; `depends` made writable
  — 27 tests across the graph, the write path and the detail
- 2026-07-22 status → review (agent)
