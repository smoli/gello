---
id: c0143
title: Waiting on a slot vs waiting in line
status: ready
created: 2026-08-05
updated: 2026-08-05
status-changed: 2026-08-05T12:35:28
epic: e02
order: 30
---

![image](../../assets/c0143/image.png)

## What

When more cards sit in `ready` than there are WIP slots, every queued card
shows the same italic "waiting on a slot" line (see the screenshot) — a wall of
identical text. Keep the honest line on the one card that is actually **next**,
and give every other queued card a random **funny queue line** so the column
reads with some life.

- **Top = next up.** Among the cards `waitingForSlot` marks (c0137), the first
  in the column's dispatch order (`order`, the c056 rule the companion
  dispatches by) keeps "waiting on a slot" — it is genuinely next when a slot
  frees. Everyone behind it gets a funny line.
- **Stable per card.** The line is picked from the card id by hash (the same
  name-hash trick `tags.ts` uses for tag colours), so a card keeps its line
  across the 2s polls — no flicker. Reaching the top (switching to the honest
  line) is the only change.
- **Just the funny line** (human's call): it replaces "waiting on a slot"
  outright for non-top cards. The lines are queue-themed, so they still read as
  "waiting", and the top card's honest line anchors the meaning.
- **50 lines, mixed** — deadpan, absurd, and dev/nerdy — in a constant list,
  chosen by `hash(id) % lines.length`.

Only the slot-waiting case changes; the pickup countdown (c0117), the blocked
line (c0125), and the activity line (c0109) are untouched.

## Acceptance criteria

- [ ] Among ready cards waiting on a slot, exactly one — the first in dispatch
      order — shows "waiting on a slot"
- [ ] Every other slot-waiting card shows a funny queue line instead
- [ ] A card's line is stable across re-renders/polls (derived from its id, not
      re-randomised each render)
- [ ] Two cards may show the same line (independent per-id hash; no uniqueness
      requirement)
- [ ] When a card becomes the top of the queue it switches to the honest line
- [ ] A single card waiting on a slot shows the honest line (it is the top) —
      no funny line
- [ ] The list holds 50 lines; the picker `hash(id) % 50` is unit-tested for
      stability
- [ ] Only the slot-waiting line changes — countdown (c0117), blocked (c0125)
      and activity (c0109) render as before
- [ ] All 50 lines are inoffensive / SFW

## Queue lines (draft — trim or swap to taste)

1. Reviewing its life choices.
2. Technically first, spiritually last.
3. Waiting with quiet dignity.
4. Practising patience. Involuntarily.
5. Holding. Please continue to hold.
6. Contemplating the nature of the queue.
7. Assured its call is important to us.
8. Ticket taken, number clutched.
9. Standing by, as instructed.
10. Not stuck. Marinating.
11. Fighting three geese for the slot.
12. Bribing the scheduler with cookies.
13. Teaching the card ahead to hurry up.
14. Building a tiny raft to jump the queue.
15. Negotiating with the WIP limit. Going poorly.
16. Stuck behind someone paying in coins.
17. Waiting for the bouncer's nod.
18. Doing hot laps in the parking lot.
19. Rehearsing its entrance.
20. Told to wait here and not move. So.
21. Spinning on a mutex.
22. `await slot;` // still awaiting.
23. Blocked on a semaphore that never signals.
24. Politely deadlocked.
25. In the run queue, dreaming of CPU.
26. Yielding the thread. Again.
27. Backing off, exponentially.
28. Cache is warm; the slot is not.
29. `SELECT * FROM slots WHERE free` — 0 rows.
30. Parked. No pun intended.
31. Third in line, first in its heart.
32. Watching the slot like a hawk.
33. Warming up in the bullpen.
34. On deck.
35. Loitering with intent.
36. Queued and quietly judging the throughput.
37. Waiting for its number to be called.
38. Almost. So very almost.
39. Buffering…
40. Doing breathing exercises.
41. Refreshing the queue in its head.
42. Next-next-next in line.
43. Holding the elevator for no one.
44. Idling with the engine running.
45. Ready. Willing. Unslotted.
46. Counting the cards ahead. Twice.
47. Reading old magazines in the waiting room.
48. Whistling nonchalantly.
49. Pretending it's not in a hurry.
50. Any second now.

## Discussion

- **Mixed-bag tone** (human's call): 50 lines across deadpan / absurd / nerdy so
  the column reads varied, not one voice.
- **Just the funny line** (human's call): cleanest; the queue theme keeps it
  legible and the top card's honest line anchors it. Rejected: a "#N in line"
  position, and honest-on-hover in the tooltip.
- **Top is honest, the rest are fun**: the next-up card is the one you actually
  care about, so it keeps the real status; the crowd behind it carries the joke.
- **Stable-by-id, not re-random**: a per-render random line would change every
  poll and flicker; hashing the id fixes each card's line, and reaching the top
  is the only transition.
- **Open**: the exact copy of the 50 lines (drafted above); whether the top
  card's line should stay "waiting on a slot" or become "next up".

## Log

- 2026-08-05 status → discuss (app)
- 2026-08-05 discussed (human): keep the honest "waiting on a slot" on the
  top-of-queue card only; the rest show a stable-per-id funny line from a
  mixed 50-line list (deadpan/absurd/nerdy); just the funny line, no position.
- 2026-08-05 status → ready (app)
