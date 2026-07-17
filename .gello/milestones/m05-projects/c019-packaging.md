---
id: c019
title: macOS build & packaging
status: backlog
milestone: m05
priority: low
depends: [c014]
tags: [infra]
created: 2026-07-16
updated: 2026-07-17
order: 80
---

## What

App icon, `tauri build` producing a distributable .dmg/.app, version wired to
package.json. Signing/notarization decision documented (personal use may skip
it initially).

## Acceptance criteria

- [ ] `pnpm tauri build` produces a launchable .app
- [ ] Icon and app name correct
- [ ] Built app opens a real repo board (smoke test)

## Notes

## Log

- 2026-07-16 created from concept breakdown
