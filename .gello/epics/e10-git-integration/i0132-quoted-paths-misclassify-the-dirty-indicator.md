---
id: i0132
title: Quoted paths misclassify the dirty indicator
status: ready
type: issue
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T12:23:26
epic: e10
order: 50
---

## What

`git status --porcelain` quotes any path holding a non-ASCII byte
(`?? ".gello/assets/gru\303\237e/x.png"`). `worktree_status` in
`src-tauri/src/git.rs` compares the raw line against the `.gello/` prefix, so a
quoted board path fails the match and counts as a *code* change: the title-bar
dot renders filled instead of hollow.

Card filenames are ASCII (`slugify` strips the rest), so this only reaches
assets and hand-named files. Fix is likely `-c core.quotepath=false` on the
status call, with a test covering a board file with an umlaut in its name.

Found while working i0127.

## Log

- 2026-08-05 status → ready (app)
