---
id: i0129
title: Stray pnpm-workspace.yaml breaks every pnpm command
status: review
type: issue
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T11:34:00
---

## What

`pnpm run companion` fails with `ERROR packages field missing or empty`, and so
does every other pnpm command in the repo — `pnpm --version` included. Not
specific to the companion.

A `pnpm-workspace.yaml` was committed by accident in 7a35458 ("New cards"):

```yaml
allowBuilds:
  esbuild: false
```

pnpm 9 treats the presence of `pnpm-workspace.yaml` as a workspace root and
requires a non-empty `packages:` field; without one it refuses to run anything.
gello is a single package — no `packages/` or `apps/` — so it is not a
workspace and the file has no place here.

`allowBuilds` is not a pnpm 9 field either (build approval lives in
`package.json` under `pnpm.onlyBuiltDependencies`, or the interactive
`pnpm approve-builds`), so the file was inert even before it started erroring —
there is no working behaviour to preserve. Removing it restores pnpm.

Confirmed: with the file moved aside, `pnpm --version` and `pnpm run companion`
both work again.

## Acceptance criteria

- [x] `pnpm-workspace.yaml` removed from the repo
- [x] `pnpm --version`, `pnpm run companion`, and the test/lint scripts run
- [x] No build-approval behaviour is lost (the file was inert on pnpm 9)

## Notes

If pnpm's "Ignored build scripts" prompt shows up on a fresh install and the
approvals want pinning, that belongs in `package.json` under
`pnpm.onlyBuiltDependencies`, not a workspace file. esbuild needs its build
script to fetch its platform binary, so it should be approved, not blocked —
the opposite of what the stray file named.

## Log

- 2026-08-05 created + fixed (agent): removed the stray pnpm-workspace.yaml
  committed in 7a35458. Reproduced the failure and confirmed removal restores
  every pnpm command.
