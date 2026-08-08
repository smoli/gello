---
id: c0168
title: Reject fix-loop
status: backlog
epic: e08
depends: [c0163, c0167]
created: 2026-08-08
updated: 2026-08-08
---

## What

Close the loop when the review agent rejects a card ([[c0161]]). On a fail
verdict the card returns to `in-progress` and the companion resumes the
**original implementer session** ([[c0095]]) with the review notes so it fixes
and re-enters `review`. The auto-review↔fix cycle is capped (~2 rounds); on
exhaustion the card parks a question for the human and the queue skips ahead
([[c0163]]). The cap bounds runaway review/fix cycling.

## Acceptance criteria

- [ ] On a fail verdict the card returns to `in-progress`.
- [ ] The original implementer session resumes with the review notes (not a
      fresh session).
- [ ] The card re-enters `review` on completion and is re-reviewed.
- [ ] The review↔fix loop is capped (~2 rounds); the count is tracked per card.
- [ ] On exhausting the cap the card parks a question for the human and the
      queue skips ahead ([[c0163]] behaviour).
- [ ] Unit-tested with the fake spawner (fail → resume → re-review; cap → park).

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
