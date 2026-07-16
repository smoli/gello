---
id: c001
title: Scaffold Tauri 2 + React/TS app with test harness
status: backlog
milestone: m01
priority: high
depends: []
tags: [infra]
created: 2026-07-16
updated: 2026-07-16
---

## What

Project skeleton: Tauri 2 shell, React + TypeScript (strict) + Vite frontend,
Vitest + React Testing Library wired, `cargo test` runnable in `src-tauri/`.
Update the Commands section in CLAUDE.md to match reality.

(Scaffolding itself is the one card that can't be test-driven; everything
after it must be.)

## Acceptance criteria

- [ ] `pnpm tauri dev` opens a window with a placeholder
- [ ] `pnpm test` runs and passes (one real sample test, no placeholders left behind)
- [ ] `pnpm typecheck` passes with `strict: true`
- [ ] `cargo test` runs in `src-tauri/`
- [ ] CLAUDE.md Commands section verified against actual scripts

## Notes

## Log

- 2026-07-16 created from concept breakdown
