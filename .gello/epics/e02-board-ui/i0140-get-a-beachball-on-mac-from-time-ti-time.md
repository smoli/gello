---
id: i0140
title: Get a beachball on mac from time ti time
status: done
type: issue
created: 2026-08-07
updated: 2026-08-07
status-changed: 2026-08-07T23:13:21
epic: e02
usage-tokens: 31876
usage-cost: 3.973283
---

## What

The window freezes for a moment now and then — macOS shows the spinning
beachball. It is not tied to one action, so it happens while the board looks
idle.

## Acceptance criteria

- [x] No Tauri command runs on the webview's main thread — every one goes to
      the async runtime, guarded by a test over the whole handler list.
- [x] A burst of file-watcher events runs `git status` once, not once per file.
- [x] Setting an app-local flag is safe when two commands overlap.

## Notes

**Root cause.** Two things compounding.

1. `#[tauri::command]` without `(async)` runs the function inline in the
   webview's IPC handler, which on macOS is the main thread (`tauri-macros`
   defaults to `ExecutionContext::Blocking`; wry registers the IPC handler as a
   `WKScriptMessageHandler`). All 22 commands were declared that way, and each
   one reads or writes files or shells out to git. `git_worktree_status` runs
   `git status --porcelain -z` over the whole repo, `git_board_changes` spawns
   one `git show` per changed file, `read_board_files` reads the whole board
   tree. While any of those ran, the window could not draw or answer events.
2. The board watcher called `refreshDirty` (that whole-repo `git status`) and
   `refreshCompanion` once per file event, undebounced. One card write already
   arrives as several FSEvents; a branch switch or an agent run arrives as
   hundreds. That queued as many whole-repo `git status` runs onto the main
   thread — which is why it hit at unpredictable moments rather than on a
   fixed action.

**Fix.** Every command is `#[tauri::command(async)]` now, so Tauri resolves it
on the async runtime. The two watcher-driven refreshes moved into the existing
150ms debounced `reconcile`, so a burst collapses into one `git status`.

Checked that nothing moved off the main thread needs to be there: `open_asset`
goes through `open::that_detached` (spawns `/usr/bin/open`, no AppKit),
`start_companion` spawns a process, `watch_board`/`watch_git_head` take a
`Mutex` and register an FSEvents watcher. No windowing calls among the
commands.

**Follow-on from the fix.** Commands can overlap now, so the flags file's
read-modify-write could lose an update. Moved it into `flags.rs` behind a
process-wide write lock, with a test that 24 concurrent writers all survive
(it fails without the lock).

Not changed: `worktree_status` still runs `git status` over the whole repo with
no pathspec. Off the main thread that no longer freezes the UI, but it stays
the most expensive thing the watcher triggers — worth a card if the dirty
indicator feels laggy on a big repo.

Not verified in the running app: the fix was checked by tests and by reading
the Tauri/wry dispatch path. A GUI smoke run was skipped because the dev server
port was already taken by the human's session.

## Log

- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
- 2026-08-07 status → review (agent)
- 2026-08-07 status → done (app)
