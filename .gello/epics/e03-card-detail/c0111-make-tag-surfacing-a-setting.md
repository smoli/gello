---
id: c0111
title: Make tag surfacing a setting
status: in-progress
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:41:01
epic: e03
---

I want to be able to toggle it on off per project

## What

A per-project setting that hides the tag UI on the board. When off, the board
stops surfacing tags: no coloured chips on card fronts, no tag filter in the
toolbar, no "Manage tags…" button. `tags:` in card frontmatter is untouched —
this is display only. Default is on (tags shown).

## Acceptance criteria

- [x] `board.yaml` carries a `show_tags` key; absent or `true` means shown,
  `false` means hidden. `parseBoardConfig` reads it into `config.showTags`
  (default `true`).
- [x] When `showTags` is false the board renders no card-front tag chips, no
  toolbar tag filter, and no "Manage tags…" button.
- [x] When `showTags` is true (or unset) all three surfaces render as before.
- [x] A "Show tags" checkbox in the board context-menu Settings submenu toggles
  the setting, writing `show_tags: false` (or removing the key at default) to
  `board.yaml` with a surgical edit.

## Notes

Decisions (card was terse; chose defaults consistent with existing patterns):

- **Storage: `board.yaml`, per project.** Consistent with `tag_colors` and
  `background`, which already live there; the setting is a property of the board
  and travels with the files. Written surgically via `setBoardKey` /
  `removeBoardKey` — `show_tags: false` when off, key removed at the default.
- **Scope: all three board tag surfaces** (card-front chips, toolbar filter,
  Manage-tags button). "Surfacing" reads as the visible tag UI; hiding only the
  chips while keeping the filter would be inconsistent.
- **Toggle home: board context-menu → Settings submenu**, next to "Show
  thumbnails". Keeping it out of the tag manager avoids a bootstrap trap (the
  manager is only reachable via the button that hiding removes).

## Log

- 2026-07-20 status → ready (app)
- 2026-07-20 status → in-progress (agent)
