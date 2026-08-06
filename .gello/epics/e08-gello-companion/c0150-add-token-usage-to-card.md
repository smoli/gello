---
id: c0150
title: Add token usage to card
status: in-progress
created: 2026-08-06
updated: 2026-08-06
status-changed: 2026-08-06T18:39:30
epic: e08
---

## Settle the writer before I build (criterion 8)

I confirmed the two facts the crux turns on:

- At run-end the runner already calls `handleExit(cardId, code, sink.usage())` — the companion **holds the final per-run usage** (the stream `result`). The agent has exited by then and never has this number.
- The companion already makes **one** surgical card write today (the c0102 `awaiting` marker, via `withAwaitingCleared` → `writeCardAtomic`). Adding `usage-*` at run-end is a small, consistent extension of that exact exception.

So **(b) agent-via-MCP cannot produce an accurate lifetime total** — mid-run the usage isn't final (the model still responds after the last tool call), and the agent would have to read even that partial figure back from the companion. It structurally under-counts.

**My recommendation: (a) — the companion writes `usage-tokens` / `usage-cost` at run-end**, reusing the existing surgical writer, cumulatively (read current → add this run → write). Accurate, minimal new code, and it keeps the numbers where they originate. The only cost is relaxing "the companion never edits cards" from one field to two — the boundary you preferred (a) to protect.

**Please pick:**

- [x] **(a) Companion writes at run-end** — recommended; accurate, reuses the c0102 write path.
- [ ] **(b) Agent MCP tool** — keeps writes strictly agent-side, accepting that the total under-counts the final turn of every run.
- [ ] Something else.

**One UI sub-question** (criterion 6 says "on the card", not where):

- [ ] Show the totals on the **card front** (always visible while scanning the board)
- [ ] Show them in the **card detail** only (front stays uncluttered)
- [ ] **Both**

Field names `usage-tokens` / `usage-cost` I'll take as written unless you say otherwise.

## What

Persist a card's companion cost **on the card**, so it survives the ephemeral
state file and travels with the repo. Two frontmatter fields, each a single
**cumulative lifetime total** that only grows:

- **`usage-tokens`** — input + output tokens, summed across every run.
- **`usage-cost`** — the CLI's `total_cost_usd`, summed. (This is the CLI's
  list-price estimate, not billed dollars, but it is the right per-card proxy —
  see the c0104 cost analysis.)

**Cumulative over the card's whole life** (human's call): every companion run
adds to the totals — across park/resume cycles, restarts (c0141), and
re-dispatches. Re-running a card three times shows the sum, not the last run.

**When, not mid-run.** A run's *complete* usage is only known at the stream's
final `result` event, i.e. at process exit. Update must happen then, never
mid-run — both because the number isn't final until then, and to avoid racing
the agent's own writes to the card body.

## The unresolved crux — who writes it

You chose **agent-via-MCP** to keep the standing boundary (the companion never
edits cards, bar the one c0102 `awaiting`-marker exception). But there is a hard
constraint: **the agent does not know its own token usage.** The per-run figures
live only in the stream `result`, which the *companion's* runner parses at exit
(c0104) — by which point the agent has finished. An MCP tool the agent calls
mid-run sees only usage-so-far and would under-count.

Two reconciliations, to decide before building:

- **(a) Companion writes the total at run-end.** It is the only party that holds
  the final number, and it already owns one card-metadata write (the c0102
  marker), so a `usage-*` field is a consistent, small extension of that
  exception. Technically sound; accurate. Trades a little more onto the
  companion's narrow write role.
- **(b) An MCP `add_usage` tool the agent calls last.** Keeps writes strictly
  agent-side, but is only correct if the usage is final at call time — which it
  is not, since the model still responds after a tool call. Prone to
  under-counting, and the tool would still have to read the figure from the
  companion's state rather than from the agent.

Recommend **(a)** unless the strict boundary matters more than an accurate
total. Either way the *numbers* originate in the companion.

## Acceptance criteria

- [ ] A card the companion has run carries `usage-tokens` and `usage-cost`
      frontmatter fields; a never-run card carries neither
- [ ] `usage-tokens` = summed input + output; `usage-cost` = summed
      `total_cost_usd`
- [ ] Both are cumulative over the card's life — every run (incl. park/resume,
      restart, re-dispatch) adds to them
- [ ] Totals are updated at run completion, never mid-run
- [ ] The update is a surgical frontmatter write — every untouched line stays
      byte-identical, and it does not clobber a concurrent agent body edit
- [ ] The app shows both totals on the card
- [ ] A malformed/absent existing total is treated as zero, not a parse failure
- [ ] The writer mechanism (companion at run-end vs agent MCP tool) is settled
      per the crux above before implementation

## Discussion

- **Both fields, cumulative lifetime** (human's calls): cost is what you watch
  for quota, tokens is model-independent; the total only grows, so it reads as
  "what this card has cost so far".
- **Writer is the open crux** (flagged): the agent lacks its own usage, so
  "agent via MCP" (the human's boundary-preserving preference) cannot capture
  the full run without the companion feeding it. Recommend the companion writes
  this one field at run-end, extending the c0102 exception — the only party with
  the final number. Left for the human to settle.
- **Written at run-end only**: avoids both an incomplete figure and a race with
  the agent's body writes.
- **`usage-cost` is a list-price estimate**, not billed dollars — a proxy, per
  the token-cost investigation; still the most useful single per-card number.
- **Open**: exact field names; whether the app shows the totals on the card
  front or only the detail; whether to keep a separate "last run" alongside the
  lifetime total (the card says total only — so no).

## Log

- 2026-08-06 status → discuss (app)
- 2026-08-06 discussed (human): two cumulative frontmatter totals
  (`usage-tokens`, `usage-cost`), lifetime-summed across all runs, updated at
  run-end. Writer left open — agent-via-MCP was preferred, but the agent lacks
  its own usage, so the companion (which parses it) is the technically sound
  writer; to be settled before build.
- 2026-08-06 status → ready (app)
- 2026-08-06 status → in-progress (agent)
- 2026-08-06 status → ready (app)
- 2026-08-06 status → in-progress (agent)
