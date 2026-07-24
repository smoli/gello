---
id: c0134
title: Context pack — assembly and injection
status: backlog
epic: e09
depends: []
created: 2026-07-24
updated: 2026-07-24
---

## What

The plumbing for the whole epic: a pure `buildContextPack(model, card)` that
returns a **bounded, structured context block**, and the wiring that injects it
into a companion run's prompt on dispatch (extending `buildTaskPrompt`).

It ships **before any content**: a minimal pack (the card's id/title and the
epic Goal) plus the two things every later step depends on —

- **A size budget.** Context injection trades input tokens for the output the
  agent would otherwise burn re-exploring. That is only a good trade while the
  pack stays bounded; an unbounded pack is re-sent every turn across a growing
  session. So the assembler caps total pack size and truncates the lowest-value
  sections first, deterministically.
- **A stable section structure** that steps 2–6 fill (board graph, conventions,
  human context, files, prior-work summary), so each later card adds a section
  without reshaping the pack.

Auto-derived where the board provides it; the human-authored and repo-derived
sections arrive in later cards. Injection is prompt-side only — the companion
still never edits cards.

## Acceptance criteria

- [ ] `buildContextPack(model, card)` is a pure function returning a structured
      pack with named sections (empty ones omitted)
- [ ] The minimal pack includes the card id + title and the epic Goal
- [ ] The pack is capped at a configured size budget; over-budget content is
      truncated lowest-value-first, deterministically
- [ ] The assembled pack is injected into the dispatch prompt, and a run with
      an empty pack is byte-identical to today's prompt
- [ ] Injection changes only the prompt — no card is written
- [ ] The section structure is stable so later steps add a section without
      reshaping the pack
- [ ] Covered by unit tests (assembly, the budget/truncation, and the injection
      wiring via the fake spawner)

## Notes

Root of the e09 plan — steps 2–7 all build on this. Keep the budget and the
section contract as the two load-bearing decisions.

## Log

- 2026-07-24 created from the e09 epic breakdown
