---
id: i0118
title: Start does not find the companion app
status: done
type: issue
ref: c0110
epic: e08
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T08:13:03
---

## Answer: yes it's feasible — but I'd advise against it here

Short version: a Rust companion would **fork the board format into two
implementations**, which is the one thing the codebase is set up to avoid.

The app renders the board *in the webview*, so the TypeScript core has to stay
either way. A Rust companion needs its own copy of frontmatter parsing, the
surgical line-edit writer, the `gelloquestion` protocol, duplicate-key repair,
column comparators, WIP/dependency rules — and the two must stay byte-compatible
forever. CLAUDE.md's "frontmatter I/O goes through one module" and "keep the Rust
layer thin — no business logic in Rust unless it must be there" both point away
from it.

Measured scope of the rewrite:

| | LOC |
|---|---|
| companion sources | 4,106 |
| companion tests | 2,289 |
| shared board core it reuses | 1,250 |
| that core's tests | 1,702 |

So ~5,400 LOC of logic plus ~4,000 LOC of tests — to solve a **packaging**
problem whose alternative is one build step and a 302 KB file. And e08 is the
fastest-moving part of the repo; a rewrite freezes companion work and doubles
the cost of every later card while both versions exist.

The only *coherent* Rust version is the inverse: move the board core itself into
Rust and have the app call it over Tauri IPC, so there's still one
implementation. That's a deliberate re-architecture of the product — its own
epic, not this bug.

**So, how do you want to proceed?**

- [x] **Ship the 302 KB bundle + user's Node** — unblocks Start now, one board
      core, smallest change. *(still my recommendation)*
- [ ] **Node SEA standalone binary** — no runtime dependency for users,
      no rewrite; ~110 MB per platform and a per-platform build matrix.
- [ ] **Rust rewrite anyway** — I'll do it, accepting the forked board core.
      Say so and I'd want it split into its own epic rather than this card.
- [ ] **Park the Rust idea as a separate strategic card** and pick one of the
      first two to unblock i0118 now. Tell me which of the two.

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
- [x] Something else — say what you'd prefer.

Scope I'd then implement: an esbuild `build:companion` step wired into the
Tauri build, the resource/sidecar plumbing, Rust path resolution for both dev
and bundled, and the `mcp` subcommand — keeping `pnpm companion` working in dev.

Just a question but coul we rewrite the companion in rust?

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

## Rust rewrite — assessment (agent, 2026-07-21)

Asked whether the companion could be rewritten in Rust. Measured scope:

| | LOC |
|---|---|
| companion sources (non-test) | 4,106 |
| companion tests | 2,289 |
| shared `src/lib` board core it reuses (`board`, `cards`, `gello-question`, `dates`, `markdown`) | 1,250 |
| that core's tests | 1,702 |

Technically feasible, but I recommend **against** it for this card:

1. **It forks the board format into two implementations.** The app renders the
   board *in the webview*, so the TypeScript core has to stay. A Rust companion
   would need its own copy of frontmatter parsing, the surgical line-edit writer,
   the `gelloquestion` protocol, duplicate-key repair, column comparators, WIP
   and dependency rules — ~1,250 LOC that must stay byte-compatible with the TS
   one forever. CLAUDE.md's "frontmatter I/O goes through one module" is exactly
   what that breaks.
2. **It contradicts the stated architecture.** CLAUDE.md: "Keep the Rust layer
   thin … No business logic in Rust unless it must be there." This would put
   ~5,400 LOC of business logic there.
3. **Cost/benefit is off.** It's a ~5,400-LOC rewrite (plus ~4,000 LOC of tests)
   to solve a *packaging* problem whose alternative answer is one build step and
   a 302 KB file.
4. **e08 is the fastest-moving part of the repo.** A rewrite freezes companion
   feature work and makes every later card cost double while both exist.

The only *coherent* Rust version is the inverse: move the board core itself into
Rust and have the app call it over Tauri IPC, so there is still one
implementation. That is a deliberate re-architecture of the whole product, not a
fix for this bug — it belongs in its own epic if wanted.

## Implementation (agent, 2026-07-21)

Human picked: ship the bundle, use the user's Node.

- **Bundle** — `pnpm build:companion` (`scripts/build-companion.mjs`, esbuild now
  an explicit devDependency) packs the companion and every dependency into
  `src-tauri/companion-dist/gello-companion.mjs`. Output goes under `src-tauri/`
  so `tauri.conf.json` can name it as a resource with no `../` (Tauri rewrites
  those to `_up_/`). The artifact is gitignored and rebuilt by both
  `beforeDevCommand` and `beforeBuildCommand`.
  - Gotcha caught by a smoke test: `yaml` ships CJS that calls `require()`, which
    ESM output has no binding for ("Dynamic require of node:process is not
    supported"). Fixed with a `createRequire` banner. ESM output is required
    regardless — the MCP launch resolves its own entry via `import.meta.url`.
- **MCP** — the stdio server is now an `mcp` **subcommand of the running entry**
  (it re-invokes itself, resolving its path through `import.meta.url`), so the
  same code works under tsx in dev and as the bundled `.mjs`. `mcp-main.ts` is
  gone; the spec + scope resolution moved to `ask-server.ts` with tests.
- **Launch** — `terminal_command` now builds `node '<bundle>' '<project-dir>'`.
  Rust resolves the bundle from the app resource dir, falling back to the crate
  dir for dev builds.
- **Where each failure surfaces** — a missing *bundle* is a packaging fault the
  app can see, so it is reported in-app. A missing *node* cannot be probed
  app-side: a GUI app on macOS does not inherit the login shell's PATH, so an
  app-side check would report node missing when the terminal can see it. The
  launched script therefore guards `command -v node` and prints a readable
  message in the terminal the user is already looking at.

**Verified.** 49 Rust tests, 815 frontend tests, typecheck and lint all green.
Ran the bundle end-to-end against a scratch board with no `ready` cards (so
nothing could be dispatched): it found the board, loaded config and wrote
`state.json`. Also checked both guard branches — node present passes args
through with spaces intact, node absent exits 1 with the message.

Not changed: `package.json`'s `bin` still points at `companion/main.ts` for the
dev `pnpm link --global` path. The app no longer depends on it.

## Log

- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
- 2026-07-21 (agent) diagnosed: the `bin` is a `.ts` needing `tsx`, so it only
  ever worked via `pnpm link --global` in the dev checkout. Proved a 302 KB
  single-file esbuild bundle is viable; asked the human to pick the
  distribution contract (system Node vs standalone binary).
- 2026-07-21 (agent) assessed a Rust rewrite (~5,400 LOC + ~4,000 LOC of tests)
  and advised against it — it would fork the board format into two
  implementations, since the webview keeps the TypeScript core either way.
- 2026-07-21 (human) chose: ship the 302 KB bundle and use the user's Node.
- 2026-07-21 (agent) implemented: esbuild bundle shipped as a Tauri resource,
  MCP served as an `mcp` subcommand of the running entry, Rust resolves the
  bundle and launches `node <bundle> <dir>` with a node guard. All tests green;
  verified end-to-end against a scratch board.
- 2026-07-21 status → review (agent)
- 2026-07-21 status → done (app)
