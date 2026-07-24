---
id: i0122
title: Card detail flickers
status: done
type: issue
created: 2026-07-24
updated: 2026-07-24
status-changed: 2026-07-24T22:08:27
epic: e02
---

Opening a card detail the display of the detail flickers periodically. It seems to be noticable when there’s an image in the card

## Acceptance criteria

- [x] A re-render of an open card detail does not tear down and reload its body
      image — the image element persists
- [x] `loadImage` is called once per image, not again on every re-render
- [x] A card with no image, and a card whose loadImage is absent, still render
      as before (the c012 "show the src as-is" path is kept)

## Notes

- Cause: `CardDetail` passed ReactMarkdown a `components` object built inline
  each render, so its `img` renderer was a new component *type* every render.
  React tears down and remounts a component when its type identity changes, so
  every AssetImage was remounted on any re-render; a fresh AssetImage starts
  unresolved, renders nothing, then async-loads — the empty→image flash that
  reads as a flicker. Any periodic re-render triggers it (the 2s companion poll
  is the usual one), and it is most visible with an image, matching the report.
- Fix: memoise the `components` map with a stable identity (`useMemo`, `[]`), so
  ReactMarkdown keeps the same `img` type and React preserves each AssetImage
  across renders. `loadImage` rides through a ref so its per-render identity
  never busts the memo; AssetImage already only calls it when `src` changes, so
  a current-via-ref loader is safe. The loader is passed only when one exists,
  keeping AssetImage's "no loadImage → show the src as-is" path (c012).
- Regression test: open the detail with an image, force two re-renders, assert
  the image element is the *same* node and `loadImage` was called once. It
  failed before (a different node each render), passes after.

## Log

- 2026-07-24 status → ready (app)
- 2026-07-24 status → in-progress (agent)
- 2026-07-24 stable markdown `components` (useMemo) so the body image is no
  longer remounted+reloaded on every re-render — reproducing test first
- 2026-07-24 status → review (agent)
- 2026-07-24 status → done (app)
