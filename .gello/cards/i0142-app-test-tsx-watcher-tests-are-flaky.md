---
id: i0142
title: App.test.tsx watcher tests are flaky
status: inbox
type: issue
created: 2026-08-07
updated: 2026-08-07
status-changed: 2026-08-07T23:10:00
---

## What

Running the full suite, a handful of `src/App.test.tsx` tests fail with
`TypeError: emitChange is not a function` — the `watchBoard` mock hasn't
handed back its callback yet when the test fires a change. Which tests fail
varies per run (seen: 0, 1, 2 and 3 failures across four runs of the same
tree), and running the file alone passes. The mock setup needs to await the
watcher registration instead of assuming it happened.

## Log

- 2026-08-07 created while working i0141
