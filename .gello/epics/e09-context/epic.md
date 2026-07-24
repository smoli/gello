---
id: e09
title: Context
status: backlog
---

## Goal

Context-engineering tools that make companion agents more efficient — by
handing each card's run the context it needs up front, instead of paying for
the agent to rediscover it. The measured cost premium of a companion run is the
cold re-exploration (a card that did 20 file reads + 33 shell calls before it
could act); this epic attacks that.

## Definition of done

- On dispatch, the companion assembles a **per-card context pack** and injects
  it into the agent's prompt, within a bounded size budget (the pack must not
  cost more input than it saves in exploration output).
- The pack is **auto-derived** from the board and repo — the card's dependency
  and relation graph, the relevant convention sections, and the files it is
  likely to touch — and **augmented** by human-authored context when present.
- A fresh session inherits what earlier cards in the epic already established,
  rather than re-deriving it.
- Measured runs show the pack reduces per-card exploration / cost, not merely
  adds input tokens — the trade is validated, not assumed.

## Plan (steps + dependencies)

Scope: companion runs only (c0130). Each step is one child card.

1. **Context pack — assembly + injection.** A pure `buildContextPack(model,
   card)` returning a bounded, structured block, wired into the companion's
   dispatch preamble (extends `buildTaskPrompt`). Ships with a **size budget**
   and a minimal pack (card + epic Goal), so the mechanism and its cap land
   before any content. Tested with the fake spawner. (← none)
2. **Board-graph context.** Populate the pack from the board: the card's
   `depends` (with title/status/one-line outcome), its `ref`/follow-up links,
   sibling cards in the epic, and the epic Goal + Definition of done. Fully
   auto-derived, no human input — the cheapest, highest-value slice. (← 1)
3. **Convention pointers.** Add the CLAUDE.md / concept.md sections relevant to
   the card, so the agent is pointed at the right rules instead of loading and
   scanning everything. (← 1)
4. **Human-authored context.** A `## Context` section on the card the human can
   fill; the pack includes it verbatim — the augmentation layer over the
   auto-derived baseline. (← 1)
5. **Relevant files / paths.** Surface the files a card is likely to touch:
   auto hints (its asset links; files its `depends` cards changed, from git;
   explicit paths) plus the human `## Context` entries. (← 1, 4)
6. **Prior-work summary.** A rolling, bounded summary of what the epic's done
   cards produced, cached under `.companion/` and refreshed as cards complete,
   so a cold session inherits decisions instead of re-deriving them. (← 1, 2)
7. **Measure the effect.** Capture per-card run cost (turns, output tokens,
   exploration reads — from the c0104 usage + runs.log) before vs after
   injection, to prove the pack cuts cold re-exploration rather than just
   adding input. (← 1, 2)

**Smallest shippable slice:** steps 1 + 2 — the injection mechanism plus the
board-graph pack — deliver the cheapest, highest-value context and stand alone.
Steps 3–6 each layer one more context kind onto the same pack; step 7 validates
the trade actually pays.

**Explicitly out:** context for interactive (non-companion) agents, and any
change to the session scope / compaction (that is the token-growth axis, a
separate concern from what a run is *handed*).
