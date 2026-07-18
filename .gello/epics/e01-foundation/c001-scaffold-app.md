---
id: c001
title: Scaffold Tauri 2 + React/TS app with test harness
status: done
epic: e01
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

- [x] `pnpm tauri dev` opens a window with a placeholder
- [x] `pnpm test` runs and passes (one real sample test, no placeholders left behind)
- [x] `pnpm typecheck` passes with `strict: true`
- [x] `cargo test` runs in `src-tauri/`
- [x] CLAUDE.md Commands section verified against actual scripts

## Notes

- Scaffolded with `create-tauri-app` (react-ts template): Vite 7, React 19,
  TS 5.8 strict, Tauri 2. Template demo (greet command, logos) stripped;
  App is a minimal "No board loaded" placeholder — even that went red→green
  (App.test.tsx written and failing before the placeholder was implemented).
- Vitest 4 + RTL + jest-dom, jsdom environment, config lives in
  vite.config.ts `test` block; setup at src/test/setup.ts.
- `cargo test` compiles and runs with 0 tests; first real Rust tests land
  with c004 (atomic writes) — noted in lib.rs.
- Rust toolchain updated 1.82 → 1.97.1 (Tauri deps require edition2024,
  Rust ≥ 1.85).
- Template's .gitignore replaced ours; covers the same plus Vite extras.
  src-tauri/target is ignored via src-tauri/.gitignore.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 all criteria verified (tests, typecheck, cargo test, dev window), status → review
