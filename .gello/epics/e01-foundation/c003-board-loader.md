---
id: c003
title: Board loader — .gello tree to board model
status: done
epic: e01
depends: [c002]
tags: [core]
created: 2026-07-16
updated: 2026-07-16
---

## What

Scan a `.gello/` directory into one BoardModel: config, milestones (with their
cards), inbox cards, invalid cards. Pure function over an abstract FS
interface so it's testable without Tauri.

## Acceptance criteria

- [x] Loads this repo's own `.gello/` tree correctly (fixture copy)
- [x] Inbox cards, milestone cards, and invalid cards are all represented
- [x] Cards without a parseable ID still surface as invalid entries
- [x] Deterministic ordering (by priority, then id) for board rendering
- [x] Next free card ID / milestone ID can be derived from the model

## Notes

- `loadBoard(files: BoardFile[]) → BoardModel` in src/lib/board.ts — pure over
  `{path, content}` pairs (paths relative to `.gello/`), zero FS coupling.
- The fixture went one better than a copy: the dogfood test walks the **live
  `.gello/` tree of this repo** at test time. Our own board can never rot —
  an unparseable card anywhere in it fails `pnpm test`. Assertions are
  structural (≥5 milestones, ≥19 cards, 0 invalid) so normal board activity
  doesn't break the test.
- `nextCardId` also counts *invalid* files via their filename prefix, so a
  broken card's ID is never handed out twice.
- Milestone folders without milestone.md stay visible (`milestone: null`)
  rather than dropping their cards.
- Card statuses validate against the loaded board.yaml columns, not the
  defaults; malformed board.yaml → default config + `configError`.
- jsdom quirk documented in the test: `import.meta.url` is rewritten to http,
  so the dogfood test resolves the repo root via `process.cwd()`.

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-16 picked up (agent), status → in-progress
- 2026-07-16 13 new tests (red → green), 36 total, typecheck clean, status → review
