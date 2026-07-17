---
id: c0060
title: UI for setting background
status: discuss
priority: normal
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T09:30:26
---

## What

An in-app way to set the board background (c047), which today is only
settable by hand-dropping a file into `.gello/assets/board/` and editing the
`background:` line in `board.yaml`. Entry point is a **right-click on the
board background** (empty area, not on cards) opening a context menu:

- **Set background image…** — native file picker; the chosen image is
  copied into `.gello/assets/board/` and `background:` is written to
  `board.yaml`.
- **Paste background from clipboard** — reads an image off the clipboard,
  writes it into `.gello/assets/board/`, updates `board.yaml`. Shown only
  when the clipboard holds an image. Needs a new Rust clipboard-image
  command (the Rust layer owns clipboard image access per CLAUDE.md; not
  built yet).
- **Remove background** — deletes the `background:` line from `board.yaml`
  (and the managed asset file), reverting to the plain board. Shown only
  when a background is set.

Setting/clearing writes `board.yaml`; the existing c047 watcher repaints
the board automatically — no separate refresh path.

## Acceptance criteria

- [ ] Right-clicking the board background (not a card) opens the context
      menu; right-clicking a card does not
- [ ] "Set background image…" opens a native image file picker; choosing a
      file copies it under `.gello/assets/board/` and writes `background:`
      to `board.yaml`; the board repaints via the watcher
- [ ] "Paste background from clipboard" appears only when the clipboard has
      an image; invoking it stores the image and sets `background:` the same
      way
- [ ] "Remove background" appears only when a background is set; it removes
      the `background:` line (surgical edit) and the managed asset, and the
      board reverts to plain
- [ ] Replacing an existing background does not leave the previous managed
      asset file orphaned (old file removed / overwritten)
- [ ] `board.yaml` writes are surgical (a new board.yaml line editor):
      unrelated keys, comments, and formatting survive byte-for-byte
- [ ] All file/clipboard writes are atomic; a failed write surfaces an error
      and leaves board.yaml unchanged

## Discussion

- **Right-click entry, no added chrome**: discoverable in place, and the
  toolbar/title bar stay uncluttered (relevant with the frameless work,
  [[c0059]]). (Rejected: a settings dialog and a toolbar button — more
  surface than a single background setting needs today.)
- **File picker + clipboard paste**: the two natural ways to supply an
  image; paste is the "screenshot → board" fast path. Drag-and-drop was
  left out (would require enabling `dragDropEnabled`, currently off, and
  collides with card drag semantics).
- **Clipboard needs new Rust**: no clipboard-image command exists yet; this
  card introduces one (read image bytes → temp/asset file). The menu item
  hides when the clipboard has no image, so the feature degrades cleanly.
- **Remove clears config + asset**: unsetting should leave no dangling
  `background:` path and no orphan file; a background swap likewise cleans
  the prior asset (formats differ, so names can change).
- **New infra — board.yaml surgical writer**: card frontmatter has a
  surgical line editor; `board.yaml` (plain YAML, not `---`-delimited) does
  not yet. This card adds one so config edits keep the parse-only,
  never-dump discipline (CLAUDE.md).
- **Builds on [[c047]]** (background config + base64 bridge + translucent
  columns, done) and pairs with [[c0059]] (background bleeding to the top).
- **Open**: fit mode (cover/contain/tile) is deliberately out — c047's
  single `background:` path stays the schema; a later card can add it.
  Asset naming (stable `background.<ext>` vs. hashed) — implementation
  detail; whichever makes orphan-cleanup simplest.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): right-click board → set (file picker) /
  paste (new clipboard Rust cmd) / remove; writes board.yaml via a new
  surgical line editor, watcher repaints. Fit mode out of scope.
