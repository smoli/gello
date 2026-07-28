---
id: i0124
title: Why is this not marked
status: in-progress
type: issue
ref: c0139
epic: e02
created: 2026-07-28
updated: 2026-07-28
status-changed: 2026-07-28T08:51:00
---

The card in the screenshot is **c0094 "Multipage data model"** — **Status: `ready`**, no dependencies, and it's *blocking* c0097.

Two separate reasons it shows no "startable" marker, and I want to fix the right one:

1. **The startable marker is backlog-only** (c0139). c0094 is in `ready` — already past the "startable" stage — so it's unmarked there no matter what. (A `ready` card is one you've already advanced.)
2. **c0139 deliberately excludes cards with *no* dependencies** — the marker means "its blockers just resolved", not "this card is unconstrained", to avoid a green mark on every plain backlog card. I flagged this as the open point when I built it; this issue is you pushing back on it, which is fair.

So: what did you expect, and which behaviour should change?

- [x] **A — Mark any unblocked backlog card startable, including ones with no dependencies.** Simple and matches "it depends on nothing → it's startable", but *every* plain backlog card (most of them) then shows the green marker, and "Start next" would advance them too. This is the c0139 reversal.
- [ ] **B — Keep c0139 as-is** (only cards whose dependencies just cleared are marked); the no-dependency card is intentionally not marked. Close this as working-as-designed.
- [ ] **C — Something about `ready` cards specifically** — e.g. you expected the marker (or a different signal) on this `ready` card, not a backlog one. If so, tell me what you'd want to see and where.

My read is you want **A** (a no-dependency card is obviously workable), but it undoes the anti-clutter reason for c0139 and it *won't* change the `ready` card in your screenshot — so I'd rather you confirm than have me ship the wrong thing. If A, do you still want the marker suppressed for cards that have never had dependencies, or is marking every unblocked backlog card actually what you want?

I the popexel repo there’s this card that is not depending on any other card. Why is it not startable.

![image](../../assets/i0124/image.png)

## Log

- 2026-07-28 status → ready (app)
- 2026-07-28 status → in-progress (agent)
