---
id: i0129
title: pnpm-workspace.yaml from pnpm 11 breaks pnpm 9 — align on pnpm 11
type: issue
status: review
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T12:05:00
---

## What

`pnpm run companion` failed with `ERROR packages field missing or empty`, and
so did every other pnpm command in the repo — `pnpm --version` included.

Root cause is a pnpm **version skew** between two machines, not the OS and not
a junk file. Windows runs pnpm 11.13.1; this Mac ran 9.15.9. pnpm 11 blocks a
dependency's build script by default and records the decision in
`pnpm-workspace.yaml` under an `allowBuilds` block that it writes itself,
seeded with `esbuild: set this to true or false`. On Windows that file was
answered `esbuild: false` and committed (7a35458, "New cards").

pnpm 9 knows nothing of that. It treats any `pnpm-workspace.yaml` as a
workspace root and refuses to run without a non-empty `packages:` field — so
the pnpm-11 file was fatal to every pnpm 9 command.

Two things I got wrong on the first pass and are corrected here:

- `allowBuilds` is **not** junk — it is pnpm 11's own build-approval key.
- Build approval does **not** live in `package.json` on pnpm 11. pnpm 11 no
  longer reads the `pnpm` field there (`onlyBuiltDependencies` is ignored with
  a warning); `pnpm-workspace.yaml` is its settings home now.

## Fix

Align both machines on pnpm 11 so the toolchain is deterministic and the
settings file has one reader:

- `packageManager: pnpm@11.13.1` in `package.json` — pnpm's own version manager
  fetches it, so both machines run the same pnpm and no pnpm-9 reader chokes on
  the workspace file.
- `pnpm-workspace.yaml` with `allowBuilds: { esbuild: true }` — **approve**
  esbuild's build (it places its platform binary), the opposite of the `false`
  the Windows checkout committed. Not a workspace; no `packages:` list, which is
  fine because only pnpm 11 reads it.

The first response was to delete the file, which unblocked pnpm 9 immediately;
aligning on pnpm 11 supersedes that and is the durable fix.

## Acceptance criteria

- [x] `pnpm --version`, `pnpm run companion`, typecheck and lint run
- [x] Both machines resolve to the same pnpm (11.13.1) via `packageManager`
- [x] esbuild's build script is approved, so the pre-run deps check passes
- [x] The workspace file no longer breaks a pnpm-9 reader (none remain; the pin
      guarantees pnpm 11)

## Notes

- One-time cost: switching pnpm major forces a `node_modules` reinstall on the
  machine that changes. This Mac rebuilt under 11; `pnpm-lock.yaml` was
  unchanged (lockfile 9.0 is shared by pnpm 9/10/11), so no dependency versions
  moved.
- The full suite has 12 failures unrelated to this change (c0118/c0120/c0121
  follow-up-trigger work, and two tests that snapshot the repo's own board and
  have drifted). They fail at HEAD independent of the pnpm switch — the reinstall
  changed no dependency versions. Left for whoever owns that work.

## Log

- 2026-08-05 created + first fix (agent): removed the stray pnpm-workspace.yaml
  committed in 7a35458; confirmed removal restores every pnpm command.
- 2026-08-05 superseded (agent): traced the file to a pnpm 9 vs 11 skew (human
  confirmed Windows on 11.13.1). Pinned pnpm@11.13.1 and restored a correct
  pnpm-workspace.yaml (`allowBuilds: esbuild: true`). Reinstalled under 11;
  typecheck, lint, companion boot verified. Corrected two mistakes in the
  original writeup (allowBuilds is a real pnpm-11 key; approval lives in the
  workspace file, not package.json).
