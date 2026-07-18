---
id: c004
title: Atomic file write layer (Rust command + TS wrapper)
status: done
milestone: m01
depends: [c001]
tags: [core, rust]
created: 2026-07-16
updated: 2026-07-16
---

## What

One write path for everything: Rust command doing write-temp-then-rename,
exposed to the frontend as a typed wrapper. Agents and editors may read the
same files at any moment — a half-written card must never be observable.

## Acceptance criteria

- [x] Rust: write is temp-file + rename on the same volume (`cargo test`)
- [x] Concurrent read during write never sees partial content
- [x] TS wrapper is the only exported write API; direct FS writes are lint-banned
- [x] Write failures propagate as typed errors to the frontend

## Notes

- Rust: `fs_write::atomic_write` — temp file `.<name>.gello-tmp.<pid>.<n>` in
  the *same directory* (same volume ⇒ atomic rename on POSIX), `sync_all`
  before rename, temp removed on failure. 5 tests written first (red via
  `todo!()` stub), incl. a reader thread hammering the file through 200
  rewrites asserting it only ever sees complete old/new content.
- Tauri command `write_file_atomic` returns `Result<(), FsError>` with
  `{kind, path, message}`; frontend wrapper `writeFileAtomic` (src/lib/fs.ts)
  rethrows as typed `FsWriteError`, keeping the requested path even for
  unstructured failures.
- Lint ban implemented via new ESLint setup (flat config, typescript-eslint):
  `@tauri-apps/plugin-fs` and `node:fs` imports banned in src/, plus a
  `no-restricted-syntax` rule banning direct `invoke("write_file_atomic")`
  outside fs.ts. Bonus: `yaml` imports restricted to cards.ts, enforcing the
  existing CLAUDE.md rule. Verified with a canary file (3/3 violations
  flagged), then removed. `pnpm lint` added to scripts + CLAUDE.md.
- tempfile added as Rust dev-dependency.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 5 Rust + 3 TS tests (red → green), lint guardrails verified, status → review
