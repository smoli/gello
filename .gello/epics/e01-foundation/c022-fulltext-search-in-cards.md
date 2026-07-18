---
id: c022
title: Fulltext search in cards
status: done
created: 2026-07-16
updated: 2026-07-17
epic: e01
status-changed: 2026-07-17T08:46:21
---

## What

A search field centered in the board toolbar. While it contains text, the
board is filtered in place: only cards matching the query stay visible in
their columns, everything else is hidden. Matching is case-insensitive
substring, AND across space-separated terms, over each card's title, body,
tags, and ID — done cards included. Clearing the field restores the full
board. Search composes with the milestone filter (both must match). Pure
client-side filtering over the in-memory board model — no index, no Rust
involvement.

## Acceptance criteria

- [x] Search field renders centered in the toolbar
- [x] Cmd/Ctrl+F focuses the search field (webview native find is
      suppressed)
- [x] A card matches when every space-separated term occurs
      (case-insensitive) in its title, body, tags, or ID
- [x] Query filters all columns including inbox; done cards are searched
      like any others
- [x] Search and milestone filter compose (AND)
- [x] Live filtering as you type; clearing the field (or Escape while the
      field is focused) restores the full board
- [x] Column counts reflect the filtered card set
- [x] Empty/whitespace-only query = no filtering

## Discussion

- **Filter-in-place over a results dropdown**: matches stay visible in
  their workflow context (column/status); no second navigation surface.
  (Rejected: ranked result list; rejected: both.)
- **Substring AND-matching over fuzzy**: predictable, no ranking story
  needed; fuzzy can be a later upgrade if it ever hurts.
- **Scope**: title + body + tags + ID (typing `c024` jumps the eye to the
  card); done cards included. Needs-attention raw files deliberately
  excluded — that lane is for repair, not discovery.
- **Client-side only**: bodies are already in the loaded board model;
  filtering is a pure function of (model, query) — easily unit-tested.
- **Defaults I chose, veto at triage**: live-as-you-type and
  Escape-clears-when-focused weren't explicitly picked in the discussion
  but are the natural behavior for an instant local filter.
- **Open**: whether card fronts should hint *why* they match when the hit
  is only in the body (e.g. a one-line snippet) — not in scope for the
  first cut.

## Log

- 2026-07-16 status → backlog (app)
- 2026-07-16 status → ready (app)
- 2026-07-16 status → backlog (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 status → done (app)

## Notes

- Pure matcher `cardMatchesQuery(card, query)` in src/lib/search.ts:
  case-insensitive substring, AND across space-separated terms, over
  id/title/tags/body. Board composes it (AND) with the milestone and type
  filters; column counts follow the filtered set. ⌘F/Ctrl+F focuses the
  centered search input (preventDefault suppresses native find); Escape
  clears. 16 tests (matcher + board).

## Log

- 2026-07-17 implemented, status → review
