---
id: c0112
title: A nice TUI for the companion
status: ready
created: 2026-07-21
updated: 2026-07-21
status-changed: 2026-07-21T12:44:57
epic: e08
---

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
