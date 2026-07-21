---
id: c0112
title: A nice TUI for the companion
status: in-progress
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T12:45:08
epic: e08
---

## You're right — my Tauri framing was wrong

The companion is a standalone Node CLI, and the TUI is purely a companion
concern. I dragged Tauri in for one narrow reason and then used it as the whole
size argument, which was the wrong frame.

The only connection: **i0118 ships a *copy* of the companion bundle inside the
app** (`bundle.resources` → `companion-dist/gello-companion.mjs`) so the Start
button works for someone without a dev checkout. That's a distribution detail,
not what the companion *is*.

**Re-framed honestly, as a Node CLI:**

| | |
|---|---|
| companion bundle today | 845 KB |
| with Ink | ~2.5 MB |

For a long-running local dev tool that's one extra parse at startup — tens of
milliseconds, once. It doesn't touch run latency or memory in any way you'd
notice. So **size is a weak argument either way**; I over-weighted it.

The real trade is: **a dependency (Ink → React + reconciler) vs hand-rolling**
layout, resize, redraw diffing and key parsing in raw ANSI.

I still lean **Ink** — your spec (header + board slice + runs table +
switchable, resizable per-card pane) is a lot of fiddly, easy-to-get-subtly-wrong
terminal code otherwise, and the React model matches the rest of the repo. But
it is a real dependency in a CLI that is otherwise lean, and that's your call.

- [ ] **Ink** — declarative layout, handles resize/redraw; +1.7 MB, adds React
- [x] **Raw ANSI** — no dependency, stays lean; I hand-roll the drawing
- [ ] Something else

**Meanwhile I built the renderer-independent half**, so this isn't a blocked
turn: `tui-model.ts` — the TTY-vs-plain decision, per-card ring buffers, the
board slice, cumulative session totals, elapsed formatting (20 tests). The
`emit` seam now carries the card id, and a runner test proves two concurrent
runs don't interleave. All of that is reused whichever way you go; only the
drawing layer depends on your answer.

## Library choice — measured, and your premise needs one correction

I landed the **model capture** first (the card's "one small gap"), since it's
needed whatever we pick. That's committed and green.

Now the open question. I measured it rather than guessing:

| | |
|---|---|
| companion bundle today | 845 KB |
| minimal Ink app, bundled | 1.7 MB |
| combined estimate | **~2.5 MB** (≈3×) |

Three findings:

- **Ink bundles to a single file.** `yoga-layout` embeds its WASM as base64
  *JavaScript*, so there's no external asset — i0118's single-file guarantee
  survives. It needs the `createRequire` banner (already in our build) and
  `react-devtools-core` aliased to a stub.
- **Ink hard-errors off a TTY** ("Raw mode is not supported"). That confirms the
  TTY gate is mandatory, and the TUI must be lazily imported so headless/piped
  runs never load it.
- **Correction:** the card weighs Ink against *"i0118's compile-to-a-binary
  plan"* — but i0118 shipped as **bundle + the user's Node**, not a binary. So
  the cost is ~1.7 MB inside a Tauri app that's already tens of MB, not bloat on
  a 110 MB binary. That's much weaker than the card assumed.

**My recommendation: Ink.** The layout you specced (header + board slice + runs
table + switchable per-card pane, resizable) is exactly what a declarative
flexbox layer is for. Hand-rolling flicker-free redraw, resize and pane regions
in raw ANSI is a lot of fiddly code that's easy to get subtly wrong, and Ink's
React model matches the rest of the repo. blessed I'd rule out — effectively
unmaintained.

- [ ] **Ink** — recommended; ~1.7 MB, React model, lazy-loaded on TTY only
- [ ] **Raw ANSI** — zero deps, stays ~845 KB; I hand-roll layout, resize,
      redraw diffing and key parsing. Slower and more bug-prone, but lean.
- [ ] Something else / you want to discuss the tradeoff further

**Minor opens I've decided** — tell me if you'd rather have it otherwise:
a pane is **dropped when its run ends** (`runs.log` keeps the full record);
**no scrollback** in a pane, just a ring buffer of the last N lines (matches the
read-only scope); session totals are **cumulative across all runs** since the
companion started.

I am confused about you metioning tauri here. the tui is for companion. that is not a tauri ap

## What

Replace the scrolling log with a live dashboard when the companion runs in a
real terminal. Almost all the data already exists — the state file carries
`runs[{cardId, phase, usage{tokens,cost,turns,duration}, activity{name,arg}}]`
plus `ready`/`waiting` — so this is largely a **rendering layer** over what
c0104 and c0109 already publish, not new plumbing.

**Layout**

- **Header** — board path, agent, **model**, scope, trigger, permission mode,
  WIP limit; session run time and running token/cost totals.
- **Board slice** (companion-relevant only) — the `ready` queue (what's next),
  cards waiting on input, and a one-line per-column tally. Not a mini kanban:
  the desktop app is on the same screen.
- **Runs** — one row per active run: card id + title, phase, elapsed,
  tokens/cost, and its current activity line (c0109).
- **Per-card log pane** — each *running* card gets its **own** pane fed by that
  card's stream; **arrow keys switch between cards**, and a key collapses or
  expands the pane.

**Activation.** TTY → TUI; piped, redirected, or headless → today's plain log
lines, unchanged. Automatic, no flag: c0110's Start button gets the TUI for
free, and c0069's headless mode keeps a pipeable stream. `runs.log` is written
identically either way.

**Read-only for now.** The keys are *view navigation* (collapse, switch card),
not runner control — pausing dispatch, killing a run, and changing verbosity
are a deliberate follow-up.

**One small gap:** the stream parser does not capture the agent's model today
(it is in the stream-json `assistant` events, e.g. `claude-opus-4-8`). The
header needs that added.

## Acceptance criteria

- [ ] Running in a TTY shows the TUI; piped or redirected output falls back to
      the current plain log lines, with no flag needed
- [ ] `runs.log` content is byte-identical whether the TUI is active or not
- [ ] The header shows board, agent, model, and session run time plus running
      token/cost totals
- [ ] The board slice lists the `ready` queue and cards waiting on input, with
      a per-column tally
- [ ] Each active run shows phase, elapsed, tokens/cost, and its current
      activity line
- [ ] Each running card has its own log pane; arrow keys switch cards and a key
      collapses/expands it
- [ ] With two concurrent runs (WIP 2), each card's stream lines go only to
      that card's pane — no interleaving
- [ ] The model is captured from the agent stream and displayed
- [ ] The TUI drives nothing: no key pauses, kills, or reconfigures a run
- [ ] Ctrl-C exits cleanly and restores the terminal; a resize re-lays out
      without corrupting the view

## Notes

- 2026-07-21 (agent) **Model capture landed** (the card's "one small gap"), since
  it is needed whatever the library turns out to be. `AgentEvent` gains a
  `model` variant, claude's parser emits it from the assistant event *before*
  the content blocks (so a malformed block list still yields the model), the
  sink keeps the latest, and the runner publishes it per run. It renders nothing
  to the terminal, so `runs.log` is untouched.
- **Library measured, not guessed** (for the open question below):
  | | |
  |---|---|
  | companion bundle today | 845 KB |
  | minimal Ink app, bundled | 1.7 MB |
  | combined estimate | ~2.5 MB (≈3×) |
  - Ink **does** bundle to a single file: `yoga-layout` embeds its WASM as
    base64 *JavaScript* (`yoga-wasm-base64-esm.js`), so there is no external
    asset and i0118's single-file guarantee survives.
  - Two build accommodations: the `createRequire` banner (already in our build
    from i0118) and aliasing `react-devtools-core` to a stub.
  - Ink's `useInput` **hard-errors** off a TTY ("Raw mode is not supported").
    That confirms the card's TTY gate is mandatory rather than a nicety, and the
    TUI must be imported lazily so headless/piped runs never load it.
- **My Tauri framing was wrong and confused things.** The companion is a
  standalone Node CLI; the TUI is purely a companion concern. Tauri only entered
  because i0118 ships a *copy* of the companion bundle inside the app
  (`bundle.resources` → `companion-dist/gello-companion.mjs`) so the Start button
  works without a dev checkout. That is a distribution detail, not what the
  companion *is*, and it was the wrong frame for a size argument.
  - Judged as what it actually is — a local Node CLI — the bundle goes
    **845 KB → ~2.5 MB**. For a long-running local dev tool that is one extra
    parse at startup, tens of milliseconds, once. It does not touch run latency.
  - So size is a weak argument either way. The real trade is a dependency
    (Ink/React) against hand-rolling layout, resize, redraw diffing and key
    parsing in raw ANSI.
- 2026-07-21 (agent) **View-model landed** ahead of the library decision, since
  it is renderer-independent: `tui-model.ts` holds the TTY-vs-plain choice,
  `LogPanes` (per-card ring buffers), the board slice, cumulative session totals
  and elapsed formatting — 20 tests. The `emit` seam now carries the card id, so
  two concurrent runs route to separate panes; a runner test asserts no
  interleaving (the acceptance criterion), using the real runner.
- **Smaller opens, decided (veto welcome)**: a pane is **dropped when its run
  ends** (`runs.log` keeps the full record, so nothing is lost); **no scrollback**
  inside a pane — a ring buffer of the last N lines, matching the read-only
  scope; session totals are **cumulative across every run since the companion
  started**, which is what "session … totals" in the header implies.

## Discussion

- **Read-only now, keys later** (human's call). Navigation keys (collapse,
  switch card) are in scope because they only change the *view*; runner control
  (pause dispatch, kill a run, toggle verbosity) is the deferred follow-up.
- **Auto TTY detection** (human's call): protects c0069 headless and any piping
  while giving c0110's terminal launch the TUI with nothing to remember.
  Rejected: a `--tui` flag (must be remembered, and Start would need updating)
  and TUI-always (breaks piping outright).
- **A pane per running card** (human's call): at WIP 2 a single merged stream
  interleaves — which is precisely what c0104's `[cardId]` prefixes work
  *around*. Separate panes remove the problem instead of mitigating it.
  Rejected: one shared log pane; activity-line-only (loses the `verbose`
  narration).
- **Companion-relevant board slices** (human's call). Rejected a mini kanban —
  it eats the terminal and duplicates the app running on the same screen.
- **The `emit` seam makes this clean**: every output line already flows through
  one injected function (`StreamSink`'s `emit`), and each sink knows its
  `cardId` — so routing lines into per-card ring buffers replaces `console.log`
  without touching the run lifecycle.
- **Open**: library choice (Ink fits — React, same model as the app — vs
  blessed vs raw ANSI) and its weight against i0118's compile-to-a-binary plan;
  what happens to a pane when its run ends (keep the tail, or drop it);
  scrollback within a pane; whether session totals aggregate across all runs or
  just the current ones.

## Log

- 2026-07-21 status → discuss (app)
- 2026-07-21 discussed (human): read-only dashboard now (navigation keys only,
  control deferred); auto TTY → TUI / piped → plain log; a collapsible log pane
  per running card with arrow-key switching; board shown as companion-relevant
  slices, not a mini kanban.
- 2026-07-21 status → backlog (app)
- 2026-07-21 status → ready (app)
- 2026-07-21 status → in-progress (agent)
