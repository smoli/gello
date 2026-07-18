---
id: c0069
title: Headless mode
status: discuss
created: 2026-07-17
updated: 2026-07-17
status-changed: 2026-07-17T16:03:28
epic: e01
---

Instead of a desktop app with an UI spin up a server that provides the UI over HTTP(S)

## What

A **headless mode**: instead of the Tauri desktop window, gello runs as a
server that serves the same React board UI over HTTP and keeps it live over a
WebSocket. Primary use is **remote / self-hosted** — run gello on a box (home
server, VPS, container) and open the board in a browser. Initial network
scope is **LAN with a shared token**: the server binds to the network and
gates access with a token; TLS/internet exposure is left to a reverse proxy
or a later card.

The central change is a **transport abstraction**. Today the frontend talks
only to Tauri: `src/lib/board-io.ts` and `src/lib/fs.ts` call `invoke`/`listen`
from `@tauri-apps/api`. Headless needs the *same UI* to speak to an HTTP/WS
backend instead. So the board-io layer becomes an interface with two
implementations:

- **Tauri IPC** (desktop, today's behavior), and
- **HTTP + WebSocket** (headless): request/response for the commands
  (find board root, read board files, read file, write atomically, remove,
  read image as base64, git branch), and a WebSocket that pushes file-change
  events (replacing the Tauri watch events) for live sync.

The server serves the built React app, applies the token gate to HTTP and the
WS handshake, and watches the `.gello/` tree to broadcast changes. The
existing optimistic-update + watcher-reconcile model already tolerates
concurrent external edits, so multiple connected browsers reconcile the same
way the desktop app already does against an agent editing files.

## Acceptance criteria

- [ ] The React board runs unchanged against either transport — desktop
      (Tauri IPC) or headless (HTTP/WS) — selected at startup, no UI code
      forking on transport
- [ ] `gello serve` (or equivalent) starts a server that serves the UI, binds
      to a configurable host/port, and prints the URL + token
- [ ] All board operations work over HTTP: load board, read/write/remove card
      files atomically, read image as base64, git branch
- [ ] File-tree changes broadcast to connected clients over WebSocket; an
      external edit (agent, another browser) updates every open board live
- [ ] A shared token gates HTTP requests and the WS handshake; a missing/wrong
      token is rejected
- [ ] Desktop-only features degrade cleanly in headless (see Discussion):
      native folder/file pickers, clipboard-image, and app-local flags each
      have a headless path or are disabled without breaking the UI
- [ ] Concurrent edits from two browsers reconcile without lost writes or
      duplicate/ghost cards (same guarantees as desktop + external agent)

## Discussion

- **Transport abstraction is the real work**: the win is one UI, two
  backends. board-io/fs become an interface; the Tauri calls move behind the
  desktop implementation, and a headless implementation talks HTTP/WS. Get
  this seam right and the server is "just" the other side of it.
- **Live sync over WebSocket**: the file watcher already drives the desktop's
  live updates via Tauri events; headless swaps the event source to a WS the
  server feeds from the same watch. The reconcile logic (`applyFileChanges`)
  is unchanged.
- **Concurrency comes for free-ish**: the board already treats disk as the
  source of truth and reconciles external edits (an agent writing files) via
  the watcher; multiple browsers are just more of that. No new locking model
  needed for the initial scope.
- **Server tech deferred**: two viable paths — (a) **Rust**, an axum/warp
  server in `src-tauri` reusing the existing FS read/write/watch code, one
  backend language; (b) **Node**, reusing the TypeScript `src/lib`
  board/cards logic, sharing parsing with the frontend but adding a Node
  runtime. Decide at implementation; the transport interface is designed the
  same either way.
- **Auth scope = LAN token now**: bind-to-network + shared token is enough
  for a trusted network; real TLS/auth for internet exposure is explicitly
  out (reverse proxy, or a follow-up). The token must cover the WS handshake,
  not just HTTP.
- **Desktop-only features need a headless answer**: native folder picker
  (`pickFolder`) → the server is launched against a chosen dir, or a path
  field in the UI; clipboard-image (i0013/[[c0060]]) → browser Clipboard API
  instead of a Rust command; app-local flags (recent projects, skill-prompt
  dismissal) → a server-side store. Each should degrade, not crash.
- **This is an epic**: transport abstraction, the server, WS live-sync, the
  token gate, and the desktop-feature fallbacks are each substantial and
  independently testable — recommend breaking into a set of cards before
  implementation.
- **Open**: server language (a/b above); whether desktop and headless ship as
  one binary with a `serve` subcommand or separate artifacts; how far to take
  auth now vs. defer; does headless also expose a plain JSON API for agents
  (overlaps the c026 MCP-server idea) or only the UI's transport.

## Log

- 2026-07-17 status → discuss (app)
- 2026-07-17 discussed (agent): headless = same React UI over HTTP/WS via a
  transport abstraction (Tauri IPC vs HTTP/WS); remote/self-hosted use, LAN
  + shared-token scope; server language deferred. Flagged as an epic;
  desktop-only features (pickers, clipboard, app-flags) need fallbacks.
