# Changelog

All notable changes to gello are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-07-18

Epics replace milestones, and the inbox becomes a status. Existing boards
migrate automatically on open.

### Added

- **Epics** — group cards under `epics/eNN-name/`, with epic-less cards in a
  flat `cards/`. An epic filter and a per-card epic selector replace the old
  milestone ones (c0076, c0077, c0078).
- **Create epics in the app** — ⌘E quick-capture (title + goal), plus "+ New
  epic" in the epic filter and on triage. A new epic opens a minimal detail
  view with its child-card rollup (i0028).
- **Inbox is a status, not a folder** — it is the first column. Capture writes
  a card to `cards/` with `status: inbox`; moving to or from inbox is a plain
  status change (c0088, c0089, c0090). `discuss` now ships in the default
  columns so the discuss skill works out of the box (i0033).
- **Board auto-commit** (opt-in, per project) — commits `.gello/` changes on a
  debounce with a per-card message, and leaves your code changes alone. A
  title-bar dot marks uncommitted board changes, or a distinct mark when code
  is also dirty (c0083).
- **Automatic migration** — an old milestone-format or inbox-folder board is
  detected on open and converted in one click (c0079, c0091).
- **Theme setting** — light, dark, or follow-OS, in the right-click menu (c0068).
- **gello-plan skill** — installed alongside discuss and onboard; breaks an
  epic into dependent child cards (c0082).

### Changed

- **Removed the `priority` field.** The manual drag rank in `backlog` / `ready`
  is the only ordering signal (i0025).
- **Board layout**: `milestones/` → `epics/`, and the `inbox/` folder is gone —
  cards live in `cards/` or `epics/eNN/`. Boards migrate automatically.

### Fixed

- **No silent data loss on concurrent edits.** A status, field, or checkbox
  change rebases on the file's current bytes, so an agent's edit and yours both
  survive; a full body edit prompts before overwriting (c015).
- **macOS: Escape no longer exits fullscreen** — it only dismisses the open
  overlay (i0030).
- Triaging a card to "No epic" no longer deletes it (i0026); triage assigns
  into `epics/` rather than a stray `milestones/` (i0029); a freshly captured
  card no longer shows "inbox" as its epic (i0031).
- More legible title-bar caption (i0024); taller, wider search box (i0023).

## [0.2.0] - 2026-07-17

Windows hardening, a real app icon, and release-pipeline fixes.

### Added

- **App icon** — a real gello mark (three kanban columns on a dark tile)
  across macOS, Windows, and Linux, plus a matching web favicon, replacing
  the default Tauri placeholder (c0071).
- **Frameless window on Windows/Linux** — custom title-bar chrome with
  drawn minimize/maximize/close controls; macOS keeps its native traffic
  lights (i0017).

### Fixed

- **Windows: quick capture created the card twice** on Cmd/Ctrl+Enter — now
  submits once (i0016).
- **Windows: the title bar showed the full path** instead of the project
  folder name (i0018).
- **Windows: the project picker** now shows the short project name (i0019)
  and never surfaces the internal `.gello` folder in recent paths (i0020);
  general project-picker robustness fixes.
- **Windows: card files with CRLF/BOM line endings** now parse correctly.
- **Pasting an image into the "report issue" popup** now works, saving the
  image under the new issue and linking it at the correct path (i0022).

### Changed

- **Release workflow** now cuts a single GitHub release per tag instead of
  racing the build matrix into duplicate releases (i0021).

## [0.1.0]

Initial release — Markdown-native Kanban board (Tauri + React): the `.gello/`
file tree as the source of truth, drag-and-drop board, card detail, live file
sync, per-column sorting, card types, and multi-project support.
