# Changelog

All notable changes to gello are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

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
