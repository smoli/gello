---
id: i0036
title: pnpm test exits non-zero on unhandled rejections in App.test.tsx
status: review
type: issue
created: 2026-07-20
updated: 2026-07-21
status-changed: 2026-07-21T00:33:53
epic: e01
---

## What

Every test passes, but `pnpm test` still exits 1:

```
 Test Files  41 passed (41)
      Tests  624 passed (624)
     Errors  2 errors
```

Both are the same unhandled rejection, from the c0083 auto-commit tests in
`src/App.test.tsx`:

```
TypeError: Cannot read properties of undefined (reading 'catch')
 ❯ src/App.tsx:488  content: await readFileRaw(`${root}/${path}`).catch(() => null)
 ❯ reconcile src/App.tsx:486
```

The debounced auto-commit test advances fake timers, which fires `reconcile`
after the test's `readFileRaw` mock has been reset, so the mock returns
`undefined` and `.catch` blows up outside any assertion.

This predates c0102 — reproducible on a clean tree with everything stashed.

It matters because "never commit red" is checked by running `pnpm test` and
reading its exit code. A suite that is green but exits 1 trains everyone to
ignore that signal.

## Acceptance criteria

- [x] `pnpm test` exits 0 on a clean tree
- [x] The c0083 auto-commit tests still assert what they assert now
- [x] `reconcile` tolerates a read that fails or returns nothing, rather than
      rejecting into the void

## Notes

- Root cause confirmed at `App.tsx` reconcile: `readFileRaw(...).catch(...)`
  assumes `readFileRaw` returns a promise. When the debounced reconcile fires
  after a test has reset the mock, `readFileRaw` returns `undefined`, so
  `undefined.catch` throws — outside any assertion, as an unhandled rejection.
- Fix: `src/lib/safe-read.ts` `readRawOrNull(read, path)` — `try { (await
  read(path)) ?? null } catch { null }`. It tolerates a rejected read and a
  non-promise/undefined return, resolving to null either way. reconcile now
  reads through it. The c0083 tests are untouched.
- Unit-tested the helper directly (`safe-read.test.ts`): success, rejection,
  and the undefined-return case that reproduced the crash.
- Discovered while satisfying criterion 1: a second, unrelated suite failure —
  `tags.test.ts` still asserted `shadeColor(..., 0.72)` after commit a52a028
  deliberately changed `CHIP_SHADE` to 0.55 (i0114). A stale test, not a
  product bug. Aligned the expected value (its own commit) so the tree is
  green; without it "never commit red" could not hold.

## Log

- 2026-07-20 created (agent): found while finishing c0102; confirmed
  pre-existing by stashing and re-running `src/App.test.tsx`.
- 2026-07-20 status → backlog (app)
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 fixed (agent): extracted readRawOrNull, wired reconcile through
  it, added safe-read.test.ts. Full suite exits 0 (808 passed). Also aligned a
  stale i0114 tags-shade assertion (separate commit) that independently redded
  the suite.
- 2026-07-21 status → review (agent)
