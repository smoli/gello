---
id: i0173
title: AFK resume can exceed the WIP limit
status: ready
created: 2026-08-09
updated: 2026-08-09
status-changed: 2026-08-09T10:06:02
epic: e08
order: 80
---

## What

Under AFK a parked run gives up its WIP slot ([[c0163]]) and the next card takes
it. When the human then answers, the resume dispatches at once — it never went
through `planDispatch` — so the board runs one over its limit until one of the
two ends. Several parked cards answered together multiply that.

Deliberate for now: holding the human's answer behind an unrelated run is worse
than a brief overshoot. Decide whether a resume should instead wait for a slot
(and how a waiting resume is reported), or stay immediate.

## Log

- 2026-08-09 status → ready (app)
