---
id: c0158
title: Want so set background for this view as well
status: in-progress
ref: c0138
epic: e02
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T11:24:03
---

## What

The cross-project activity view (c0138) takes the whole shell while it is open,
but it always renders on the plain window canvas — the board's background
(c047/c0060) applies to the board only. Give the activity view the same
right-click → Background… picker: image, colour or gradient.

The view spans several projects, so the setting is **app-local** (one flag, like
the view's project selection), not a `board.yaml` key. An image is remembered by
its absolute path — there is no repo to copy it into.

## Acceptance criteria

- [x] Right-clicking the activity view's empty background opens a context menu
      offering Background…
- [x] The picker sets a colour or a gradient, previewing live over the view, and
      one Apply persists it
- [x] An image is picked from the filesystem and remembered by its absolute
      path; no file is copied into any project
- [x] The background is stored app-locally, not in any project's `board.yaml`
- [x] Reopening the view restores the stored background
- [x] Remove clears the background and the stored setting
- [x] The activity background and the board background are independent

## Notes

- **App-local, one flag** (`activity-background`), alongside `activity-projects`.
  A `board.yaml` key was not an option: the view aggregates N projects, and
  picking one of them to hold the setting would make the background belong to
  whichever project happened to be first.
- **An image is stored as the absolute path picked**, read straight through
  `imageDataUrl`. The board copies its image into `assets/board/` and stores a
  board-relative path (`set_board_image`); here there is no root to copy into,
  so the file stays where it is and a moved or deleted file leaves the view
  plain.
- **The picker and the context menu are the board's**, rendered in the activity
  branch with activity handlers. The menu drops the board-only entries (project
  folder, terminal, per-project settings) and keeps Reload, Background… and
  Theme. `bgPreview`/`bgMenu` are reused — the two modes never render at once.
- **`backgroundStyle(css)` moved into `lib/background.ts`.** Board.tsx had the
  longhand choice (background-image vs background-color) inline; both surfaces
  call the shared one now, so `background-size: cover` survives in both.
- `.multi-with-bg` mirrors `.board-with-bg`: cover/centre, translucent blurred
  columns, and the i0133 blur drop while a card is being dragged.

## Log

- 2026-08-08 status → in-progress (agent)
- 2026-08-08 built: `background`/`onBackgroundContextMenu` on MultiProject, the
  app-local `activity-background` flag, and the shared `backgroundStyle` helper.
