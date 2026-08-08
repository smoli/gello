---
id: c0167
title: AI review agent dispatch
status: ready
epic: e08
depends: [c0162, c0164, c0166]
created: 2026-08-08
updated: 2026-08-08
status-changed: 2026-08-08T23:35:48
order: 60
---

## What

Wire the review run ([[c0161]]). With AFK on, a card entering `review`
dispatches a **fresh review run** — a separate agent session with a session key
distinct from the implementer's (so it does not collide under `scope: epic`) —
using the review skill ([[c0166]]). The agent records its verdict; on pass the
card lands in `signoff` ([[c0164]]). AFK off: `review` cards sit as today. The
review run respects the WIP limit and the session gate like any run.

## Acceptance criteria

- [ ] AFK on: a card entering `review` dispatches a review run using the review
      skill.
- [ ] The review run uses a session key distinct from the implementer's (no
      collision under `scope: epic`).
- [ ] AFK off: `review` cards are not auto-reviewed (unchanged).
- [ ] On pass the card ends in `signoff`; the verdict is recorded on the card.
- [ ] The review run respects the WIP limit and the session gate.
- [ ] Unit-tested with the fake spawner (review dispatch; pass → signoff;
      session-key distinctness; AFK-off no-op).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
