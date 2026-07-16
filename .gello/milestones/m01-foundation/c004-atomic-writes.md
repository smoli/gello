---
id: c004
title: Atomic file write layer (Rust command + TS wrapper)
status: backlog
milestone: m01
priority: high
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

- [ ] Rust: write is temp-file + rename on the same volume (`cargo test`)
- [ ] Concurrent read during write never sees partial content
- [ ] TS wrapper is the only exported write API; direct FS writes are lint-banned
- [ ] Write failures propagate as typed errors to the frontend

## Notes

## Log

- 2026-07-16 created from concept breakdown
