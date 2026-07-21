---
id: i0118
title: Start does not find the companion app
status: in-progress
type: issue
ref: c0110
epic: e08
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T07:25:59
awaiting: input
---

```gelloquestion
## Root cause found — now a distribution-contract decision

`package.json` declares `bin: { "gello-companion": "companion/main.ts" }` — a
**TypeScript** entry with a `#!/usr/bin/env -S npx tsx` shebang. It only ever
resolves after `pnpm link --global` in the dev checkout, so c0110's hard-coded
`gello-companion` gives `command not found`. As you said: that was never going
to work outside the dev repo.

Two facts that shape the fix:

- Bare `node companion/main.ts` **doesn't** work even on Node 24 — the shared
  `src/lib` modules use extensionless imports that Node's resolver rejects
  (`tsx` hides this in dev). So a **bundler is required** either way.
- I proved the bundle: esbuild (already here via vite) packs `main.ts` + all
  deps (`yaml`, MCP SDK, `src/lib`) into **one 302 KB file** in ~11ms, run as
  `node <file> <project-dir>`.

Either way the MCP stdio entry (`mcp-main.ts`) must become a **subcommand of
the same bundle**, since a shipped companion has no `.ts` files.

**Which distribution contract do you want?**

- [ ] **Ship the 302 KB bundle, use the user's Node** *(my recommendation)* —
      the `.mjs` goes in the app bundle as a Tauri resource; Start runs
      `node <resource> <dir>`. Tiny, cross-platform for free, simple release.
      Cost: requires `node` on PATH — which a gello user almost certainly has,
      since the companion exists to drive an agent CLI and `claude` itself
      ships as a global npm package. I'd also make a missing `node` produce a
      clear in-app error instead of a silent terminal failure.
- [ ] **Fully standalone binary (Node SEA sidecar)** — embeds the Node runtime,
      so nothing is required on the user's machine. Cost: ~110 MB per platform,
      a per-platform build matrix, and a heavier release process.
- [ ] Something else — say what you'd prefer.

Scope I'd then implement: an esbuild `build:companion` step wired into the
Tauri build, the resource/sidecar plumbing, Rust path resolution for both dev
and bundled, and the `mcp` subcommand — keeping `pnpm companion` working in dev.
```

Last login: Mon Jul 20 23:38:28 on ttys007
gello-companion '/Users/stephan/WebstormProjects/gello'
stephan@MacBookPro ~ % gello-companion '/Users/stephan/WebstormProjects/gello'
zsh: command not found: gello-companion
stephan@MacBookPro ~ % 

It was not isntalled via PNPM. That would ony work from the dev repoy anyways. We need a way to distribute the companion with the built gello installer

## Investigation (agent, 2026-07-21)

**Root cause.** `package.json` declares `bin: { "gello-companion": "companion/main.ts" }`
— a **TypeScript** entry whose shebang is `#!/usr/bin/env -S npx tsx`. That is
only reachable after `pnpm link --global` in the dev checkout, and even then it
needs `tsx`. c0110 hard-coded `gello-companion` in the launch command, so with
no link the terminal opens and says `command not found`. Confirmed:
`which gello-companion` → not found.

**Why a bundler is required.** Bare `node companion/main.ts` does not work even
on Node 24 (which strips types): the shared `src/lib` modules use extensionless
imports (`from "./cards"`), which Node's resolver rejects. `tsx` papers over
this in dev. So any distributable form has to go through a bundler.

**Feasibility proven.** esbuild (already present transitively via vite) bundles
`companion/main.ts` — deps and all (`yaml`, the MCP SDK, `src/lib`) — into a
single ESM file of **302 KB** in ~11ms. Invoked as `node <file> <project-dir>`,
so it needs no shebang.

**Knock-on.** `askServerSpec` currently launches the MCP server by pointing
`process.execPath` + `execArgv` (the tsx loader) at `mcp-main.ts`. A bundled
companion has no `.ts` files, so the MCP stdio entry has to become a
**subcommand of the same bundle** (`… companion.mjs mcp`) under either option
below.

The open decision is the distribution contract — see the question.

## Log

- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 (agent) diagnosed: the `bin` is a `.ts` needing `tsx`, so it only
  ever worked via `pnpm link --global` in the dev checkout. Proved a 302 KB
  single-file esbuild bundle is viable; asked the human to pick the
  distribution contract (system Node vs standalone binary).
