---
id: i0036
title: pnpm test exits non-zero on unhandled rejections in App.test.tsx
status: inbox
type: issue
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T07:59:30
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

- [ ] `pnpm test` exits 0 on a clean tree
- [ ] The c0083 auto-commit tests still assert what they assert now
- [ ] `reconcile` tolerates a read that fails or returns nothing, rather than
      rejecting into the void

## Log

- 2026-07-20 created (agent): found while finishing c0102; confirmed
  pre-existing by stashing and re-running `src/App.test.tsx`.
