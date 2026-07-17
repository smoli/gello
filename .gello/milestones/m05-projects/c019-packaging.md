---
id: c019
title: github build pipeline for mac, windows, linux
status: discuss
milestone: m05
priority: low
depends: [c014]
tags: [infra]
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T08:22:40
---

## What

App icon, `tauri build` producing a distributable version wired to
package.json. Signing/notarization decision documented (personal use may skip
it initially).

## Acceptance criteria

- [ ] `pnpm tauri build` produces a launchable .app
- [ ] Icon and app name correct
- [ ] Built app opens a real repo board (smoke test)

## Notes

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 status → discuss (app)
