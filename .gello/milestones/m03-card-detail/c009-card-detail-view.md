---
id: c009
title: Card detail view with rendered Markdown
status: done
milestone: m03
depends: [c005]
tags: [ui]
created: 2026-07-16
updated: 2026-07-16
---

## What

Clicking a card opens its detail: frontmatter fields as a compact header,
body rendered as Markdown, acceptance-criteria checkboxes toggleable (toggle
writes the file).

## Acceptance criteria

- [x] Body renders as Markdown (headings, lists, code, images)
- [x] Checkbox toggle persists via atomic write, preserving the rest of the body
- [x] Header shows and allows editing status, priority, tags — milestone is
      shown read-only (see Notes: milestone editing = triage → c013)
- [x] Frontmatter edits round-trip through the c002 module only

## Notes

- **Criterion adjusted, flagged per CLAUDE.md rule**: editing `milestone:`
  without moving the file would desync the field from the folder the board
  groups by. Milestone changes are file moves + asset-link rewrites = c013
  triage. Header shows the milestone read-only until then.
- Rendering: react-markdown + remark-gfm (new deps). Checkbox inputs are
  re-enabled via a component override that assigns document-order indices
  during the render pass.
- Toggling: `toggleTaskItem(body, index)` in src/lib/markdown.ts — surgical
  single-line flip, indented-code-block lines excluded, out-of-range throws.
  Persisted via replaceCardBody → atomic write; rest of body byte-identical.
- board-actions generalized: `saveCardFields` (moveCard is now a one-liner
  over it) + `saveCardBody`; App's optimistic-update/rollback extracted into
  one `applyAction` used by drag-drop, field edits, and checkbox toggles.
- Tags edit: comma-separated input, committed on Enter/blur, written as
  flow-style list (`tags: [ui, core]`) via new array support in
  updateCardFields.
- Detail opens on card click or Enter; closes via ✕, Escape, or backdrop.
- Images render as <img> but relative asset paths don't resolve in the
  webview yet — asset resolution is c011's "inline rendering" criterion.
- 26 new tests across markdown/cards/board-actions/CardDetail/Board/App.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 26 tests (red → green), all gates clean, status → review
