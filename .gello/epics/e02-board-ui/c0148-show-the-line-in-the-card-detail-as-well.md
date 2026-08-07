---
id: c0148
title: show the line in the card detail as well
status: review
ref: c0143
epic: e02
created: 2026-08-05
updated: 2026-08-07
status-changed: 2026-08-07T07:10:51
usage-tokens: 59068
usage-cost: 45.673019
---

"The line" on the card front (ref c0143) is really a **stack** of live-status treatments sharing one slot, in priority order: the c0109 activity line ("Editing runner.ts"), the c0117 pickup countdown ("picking up in 7s"), the c0137/c0143 **waiting-on-a-slot / funny queue line**, the c0141 "run stopped — Restart", and the c0123 blocked line ("waiting on c0072"). The card **detail** currently gets none of the companion state (`runner`) or the board facts (blocked / slot-free / startable) these need, so this needs some plumbing either way.

Two decisions:

**1. Which line(s) should the detail show?**

- [ ] **A — Just the c0143 slot line** ("waiting on a slot" / the queue line). The most literal read of the ref, but it'd be odd to show *only* that and not, say, the activity line when a card is running and you open it.
- [x] **B — The whole live-status line the front shows** (whichever treatment currently applies: activity / countdown / waiting-on-slot / stopped / blocked), surfaced in the detail as one line. Consistent — the detail mirrors the front. *(My recommendation.)*

**2. If B, do the interactive bits come along, or is the detail line read-only text?**

- [ ] Read-only text (e.g. "run stopped" without the Restart button; blocked deps as plain ids — they're already listed in the detail's Depends-on section)
- [ ] Full parity — Restart button and clickable blocked-dep links too

**Where I'd put it:** a single status line in the detail header, just under the title / status row, styled like the front's `.card-activity`. I'd extract the front's line into a shared component so front and detail can't drift.

My recommendation: **B, read-only text** — surface the same status the front shows so opening a card doesn't hide it, but keep the detail line informational (the Restart action and dep links already have homes elsewhere). Tell me if you'd rather the narrow **A**, or full interactive parity.

## Acceptance criteria

- [x] The card detail shows the same live status line the front shows —
      whichever treatment applies (activity / countdown / waiting-on-a-slot /
      stopped / blocked / startable)
- [x] The detail line is read-only text (no Restart button, no clickable
      blocked-dep links); those actions keep their existing homes in the detail
- [x] Front and detail can't drift — both render one shared component from one
      resolver
- [x] No behaviour change on the card front (its interactive Restart / dep
      links stay)

## Resolution

Chose **B, read-only** (decision 1: B; decision 2 left blank → the recommended
read-only). Built it as agreed — a shared resolver + component so the two views
can't drift:

- `lib/card-status.ts` — `cardStatusLine(runner, card, facts, now)` resolves the
  single highest-priority line (kind + read-only text + treatment class), in the
  front's exact priority order. `resolveCardStatusLine(model, card, runner, now)`
  is the detail's entry point (it derives the board-wide slot facts itself).
- `components/CardStatusLine.tsx` — the one renderer: plain text for every kind,
  plus the interactive Restart button (stopped) and clickable dependency links
  (blocked) *only when the front passes handlers*. The detail passes none →
  read-only.
- The card **front** was refactored from its six inline `{cond && <p>}` blocks
  to this one component; all 152 Board tests pass unchanged (the treatments are
  mutually exclusive, so one highest-priority line matches the old stack).
- `hasFreeWipSlot` moved from Board into `board.ts` so the resolver and the board
  share the one WIP-slot rule.

## Log

- 2026-08-06 status → backlog (app)
- 2026-08-07 status → ready (app)
- 2026-08-07 status → in-progress (agent)
- 2026-08-07 B/read-only: shared cardStatusLine resolver + CardStatusLine
  component; front refactored to it (152 Board tests unchanged), detail shows it
  read-only — new tests for the resolver, the component, and the detail line
- 2026-08-07 extracted the front's status line into a shared resolver
  (card-status.ts) + CardStatusLine component; front refactored to use it,
  detail shows it read-only — 19 tests, front's 152 unchanged
- 2026-08-07 status → review (agent)
