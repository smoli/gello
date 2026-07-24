---
id: c0136
title: Measure the context-pack effect
status: backlog
epic: e09
depends: [c0134, c0135]
created: 2026-07-24
updated: 2026-07-24
---

## What

Prove the pack pays. Context injection trades input tokens for the output an
agent burns re-exploring, and that trade must be *validated*, not assumed — an
unfocused pack could add input without cutting exploration and make runs more
expensive.

The companion already records per-run cost (c0104: turns, input/output tokens,
cost, duration in the state file and `runs.log`). This card turns that into a
**before/after comparison**: run the same card (or a matched set) with the pack
off and on, and report the deltas that matter — output tokens, turns, and the
volume of exploratory tool calls (Read/Grep/Glob/Bash) the agent makes before
its first real edit.

Deliverable is a small, repeatable measurement — a documented procedure plus a
script over `runs.log` — not a one-off number, so the trade can be re-checked as
the pack grows through steps 3–6.

## Acceptance criteria

- [ ] A pack on/off toggle exists for a run (config/env), so the same card can
      be measured both ways
- [ ] A script reads `runs.log` and reports per-run output tokens, turns, and
      exploratory-tool-call count
- [ ] A documented procedure produces a before/after comparison for a card or
      matched set
- [ ] The comparison shows the pack's *net* effect (input added vs. output and
      exploration saved), not output alone
- [ ] The measurement is repeatable, so it can be re-run as later steps enlarge
      the pack

## Notes

Closes the loop opened by the session's token-cost investigation: the premium
was cold re-exploration, and this is how we confirm the pack removes it rather
than just adding tokens. The exploratory-tool-call count is the most direct
signal — a well-fed agent should read fewer files before acting.

## Log

- 2026-07-24 created from the e09 epic breakdown
