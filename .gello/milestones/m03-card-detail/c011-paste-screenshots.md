---
id: c011
title: Paste/drag screenshots into a card
status: done
milestone: m03
depends: [c009]
tags: [ui, rust]
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T13:13:37
---

## What

⌘V with an image on the clipboard (or dragging an image file) into a card
detail saves it to `.gello/assets/<card-id>/` and inserts a relative Markdown
image link at the cursor. Images render inline.

## Acceptance criteria

- [x] Clipboard image lands as PNG in `.gello/assets/<card-id>/` with a
      readable, collision-free filename
- [x] Relative link inserted resolves both in-app and on GitHub
- [x] Dragged image files work the same way
- [x] Inline rendering in card detail
- [x] Non-image paste is untouched (normal text paste)

## Notes

- Architecture: a new Rust `write_asset` command (base64 → bytes, dedupes the
  filename, returns the board-relative path); pure helpers in `src/lib/assets.ts`
  (link prefix by card depth, mime→ext, name suggestion, cursor splice, path
  resolution, base64); paste/drop wired on the editor textarea in `CardDetail`;
  inline rendering via an `AssetImage` that resolves local srcs to data URLs
  through `loadImage` (App → `imageDataUrl`). Remote/data URLs pass through.
- Filenames: a dragged file keeps its (kebab-cased) name; a clipboard paste
  uses the File's name (WKWebView names screenshots `image.png`) or a
  `pasted-YYYYMMDD-HHMMSS` fallback. Rust appends `-2`, `-3`, … on collision.
- MANUAL VERIFY (not reachable in jsdom): real ⌘V of a screenshot in the Tauri
  WKWebView populates `clipboardData.items`/`File.arrayBuffer()`, and the
  data-URL round-trip renders inline. Text paste and file-drag paths too.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): Rust write_asset + assets.ts helpers +
  CardDetail paste/drop/inline-render + App wiring. All 5 criteria have tests
  (cargo + vitest); WKWebView clipboard behavior flagged for manual verify.
- 2026-07-17 status → done (app)
