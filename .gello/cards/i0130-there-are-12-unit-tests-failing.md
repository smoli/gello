---
id: i0130
title: there are 12 unit tests failing!
status: review
type: issue
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T12:02:59
---

## What

`pnpm test` was red: 12 failures in 4 files, from three unrelated causes.

1. **Ten follow-up trigger tests** (`Board.test.tsx`, `App.test.tsx`). The card
   front now carries two triggers — `i` (issue) and `c` (task) — and both were
   labelled `Follow up on <id>`. The tests query by that name and hit two
   matching buttons. The duplicate label is a real defect: the two buttons
   announce identically, so the `i`/`c` distinction only exists visually.
2. **The dogfood test** (`board.test.ts`) pinned `wip_limits` to
   `{ "in-progress": 2 }` while reading this repo's live `board.yaml`, which the
   human edits from the app. It is now 1.
3. **The demo-board test** (`demo/holzhof-board.test.ts`) expects one malformed
   card. The demo's malformed card (i002, duplicate `status:` key) had been
   repaired — the i0034 one-click fix, presumably run while demoing it.

## Acceptance criteria

- [x] Each card-front follow-up trigger names its kind, so the two buttons have
      distinct accessible names
- [x] The dogfood board test asserts that `wip_limits` parses, not what the
      human currently has it set to
- [x] The demo board has its malformed card back
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `cargo test` all pass

## Notes

- The labels are `Follow up on c004 with an issue` / `… with a task`. Tooltips
  were already distinct; only the `aria-label` was ambiguous.
- The demo board is gitignored but git-initialised, so the authored malformed
  card came back with `git checkout` inside `demo/holzhof/`. Its board.yaml
  background change is a later deliberate edit and was left alone.
- Nothing else about the follow-up feature was touched — the `i`/`c` kinds and
  their handlers work; the tests were only written before the second button
  existed.

## Log

- 2026-08-05 status → ready (app)
- 2026-08-05 status → in-progress (agent)
- 2026-08-05 fixed the three causes; 1234 frontend tests, 55 Rust tests green.
- 2026-08-05 status → review (agent)
