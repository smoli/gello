---
id: c019
title: github build pipeline for mac, windows, linux
status: review
milestone: m05
priority: low
depends: [c014]
tags: [infra]
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T09:21:58
order: 15
---

## What

App icon, `tauri build` producing a distributable version wired to
package.json. Signing/notarization decision documented (personal use may skip
it initially).

## Acceptance criteria

Scope resolved to a **pure CI pipeline**: Tauri builds for the host OS only,
so Windows/Linux bundles cannot be produced on the maintainer's Mac —
cross-platform must run on native GitHub runners.

- [x] GitHub Actions release workflow builds on macOS, Windows, and Linux
      (matrix, one native runner per target)
- [x] macOS job produces a universal (arm64 + x86_64) bundle
- [x] Linux job installs the Tauri v2 system deps (webkit2gtk-4.1 etc.)
- [x] Triggered by a `v*` tag push (and manual dispatch); drafts a GitHub
      Release with the installers attached
- [x] Frontend production build (`pnpm build`) — which CI runs before the
      Tauri build — passes locally
- [x] App icon + product name wired (icons/ present, productName "gello",
      identifier com.stephan.gello in tauri.conf)
- [ ] Runtime verification: pushing a tag produces launchable installers on
      all three platforms (only confirmable via an actual tag push / Actions
      run — cannot be exercised in this environment)

## Notes

- Cross-compilation from macOS to Windows/Linux is not supported by
  `tauri build`; a matrix over macos-latest / ubuntu-22.04 / windows-latest
  is the standard and only reliable approach (confirmed with Stephan).
- Workflow: `.github/workflows/release.yml` using `tauri-apps/tauri-action`.
  Release is created as a **draft** so the maintainer reviews before
  publishing. No code signing configured (personal-use default; add certs +
  `tauri.conf` signing later if distributing widely).
- The one open criterion is inherently a push-to-verify step; everything
  authorable and locally checkable is done.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 status → discuss (app)
- 2026-07-17 status → ready (app)
- 2026-07-17 pure CI release workflow (3-platform matrix), status → review
