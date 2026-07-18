---
id: c047
title: Allow for those full image backgrounds
status: done
created: 2026-07-16
updated: 2026-07-16
epic: e02
---

just like trello

## Log

- 2026-07-16 status → ready (app)
- 2026-07-16 status → done (app)

## Notes

- `background: <path>` in board.yaml (relative to .gello/, e.g.
  assets/board/bg.jpg) — config, not app state, so it travels with the repo.
- Image served into the webview as a data URL via a new Rust
  `read_file_base64` command (no asset-protocol scope widening); mime
  inferred from the extension (jpg/png/webp/gif).
- With a background set, columns turn translucent with backdrop blur so
  cards stay readable over any photo; toolbar selects get an opaque backing.
- Live-updates via the existing watcher: changing `background:` in
  board.yaml swaps the image without a reload.
- To use: drop an image at .gello/assets/board/bg.jpg and add the config
  line — the board repaints on save.

## Log

- 2026-07-16 status → ready (app)
- 2026-07-17 implemented (config key, base64 bridge, translucent columns), status → review
