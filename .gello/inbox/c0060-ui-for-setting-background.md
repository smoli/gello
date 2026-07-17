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
settable by hand-editing `board.yaml`. The background can now be an **image**,
a **solid color**, or a **two-color linear gradient with an angle**.

**Storage**: `background:` stays a single string, interpreted by its shape —
a relative asset path (image, today's behavior), a hex/CSS color
(`#1a2b3c`), or `linear-gradient(<angle>deg, <from>, <to>)`. Colors and
gradients are applied directly as CSS; only image mode copies a file.

**Entry point**: a **right-click on the board background** (empty area, not
on cards) opens a context menu that includes an **inline picker panel** with
a mode toggle — **Image / Color / Gradient**:

- **Image** — native file picker (or paste, below); the chosen image is
  copied into `.gello/assets/board/` and its path written to `background:`.
- **Color** — a color picker; `background:` gets the hex value.
- **Gradient** — two color pickers plus an **angle** control (0–360°);
  `background:` gets `linear-gradient(<angle>deg, <from>, <to>)`. The board
  previews live as the controls change; committing persists one write.
- **Paste image from clipboard** — reads an image off the clipboard, stores
  it like the file picker. Shown only when the clipboard holds an image.
  Needs a new Rust clipboard-image command (the Rust layer owns clipboard
  image access per CLAUDE.md; not built yet).
- **Remove background** — clears `background:` (and any managed image
  asset), reverting to the plain board. Shown only when one is set.

Setting/clearing writes `board.yaml`; the existing c047 watcher repaints
the board automatically — no separate refresh path.

## Acceptance criteria

- [ ] Right-clicking the board background (not a card) opens the context
      menu with an Image / Color / Gradient mode toggle; right-clicking a
      card does not
- [ ] Image mode: native file picker copies the file under
      `.gello/assets/board/` and writes its path to `background:`; the board
      repaints via the watcher
- [ ] Color mode: choosing a color writes that hex to `background:`; the
      board shows a solid color
- [ ] Gradient mode: two colors + an angle (0–360°) write
      `linear-gradient(<angle>deg, <from>, <to>)` to `background:`; the
      board shows the gradient; the angle is respected
- [ ] Color and gradient controls update the actual board background in
      real time as they change — every color pick and angle adjustment
      repaints the board immediately (via local state, not the swatch alone)
- [ ] A single `board.yaml` write persists the value on commit (not one per
      slider tick); dismissing without commit reverts the board to the
      previously saved background
- [ ] Opening the picker on an existing background pre-populates it from the
      current `background:` value (path / color / parsed gradient)
- [ ] A `background:` value is classified by shape: asset path vs. color vs.
      `linear-gradient(...)`; colors/gradients apply as CSS with no file I/O
- [ ] Translucent-column treatment (c047) applies for any background —
      image, color, or gradient — so cards stay readable
- [ ] "Paste image from clipboard" appears only when the clipboard has an
      image; invoking it stores the image and sets `background:` like the
      file picker
- [ ] "Remove background" appears only when set; clears `background:`
      (surgical edit) and any managed image asset; board reverts to plain
- [ ] Switching away from an image background does not orphan its managed
      asset file (removed on replace/remove)
- [ ] `board.yaml` writes are surgical (a new board.yaml line editor):
      unrelated keys, comments, and formatting survive byte-for-byte
- [ ] All file/clipboard writes are atomic; a failed write surfaces an error
      and leaves board.yaml unchanged

## Discussion

- **`background:` stays one CSS-value string**: an asset path, a color, or a
  `linear-gradient(...)` — classified by shape, applied directly as CSS
  (colors/gradients need no file). Minimal schema change over c047, and the
  app parses the value back to pre-populate the picker. (Rejected: a
  structured `{type, …}` mapping — cleaner to render from but a bigger
  schema change and c047 migration; rejected: separate color/gradient keys
  with precedence rules — more surface, more edge cases.)
- **Inline picker panel, not per-mode submenus**: one panel with an
  Image/Color/Gradient toggle keeps mode-switching and live preview in a
  single place. (Rejected: submenu-per-mode — more clicks, no live compare.)
- **Live, real-time repaint of the real board**: color and gradient changes
  drive the actual board background as you adjust them (local override state
  layered over the saved value), not a small in-panel swatch — you judge the
  color against the real cards. Only the committed value writes `board.yaml`
  (one write, not per slider tick); dismissing reverts to the saved
  background.
- **Translucent columns generalized**: c047 turned columns translucent for
  an image; that now triggers for any non-empty background so cards stay
  readable over a color or gradient too.
- **Right-click entry, no added chrome**: discoverable in place, and the
  toolbar/title bar stay uncluttered (relevant with the frameless work,
  [[c0059]]). (Rejected: a settings dialog and a toolbar button — more
  surface than a background setting needs today.)
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
- **Open**: image fit mode (cover/contain/tile) still deferred — the CSS-
  string approach could carry it later without schema change. Whether to
  support >2 gradient stops or radial gradients (out for now — two colors +
  angle only). Asset naming (stable `background.<ext>` vs. hashed) — pick
  whichever makes orphan-cleanup simplest.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): right-click board → set (file picker) /
  paste (new clipboard Rust cmd) / remove; writes board.yaml via a new
  surgical line editor, watcher repaints. Fit mode out of scope.
- 2026-07-17 extended (agent): background can be image / solid color /
  two-color gradient with angle, stored as one CSS-value string; inline
  picker panel with Image/Color/Gradient toggle + live preview.
