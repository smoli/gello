---
id: c0168
title: Reject fix-loop
status: done
epic: e08
depends: [c0163, c0167]
created: 2026-08-08
updated: 2026-08-26
status-changed: 2026-08-26T19:44:58
---

## What

Close the loop when the review agent rejects a card ([[c0161]]). On a fail
verdict the card returns to `in-progress` and the companion resumes the
**original implementer session** ([[c0095]]) with the review notes so it fixes
and re-enters `review`. The auto-review↔fix cycle is capped (~2 rounds); on
exhaustion the card parks a question for the human and the queue skips ahead
([[c0163]]). The cap bounds runaway review/fix cycling.

## Acceptance criteria

- [x] On a fail verdict the card returns to `in-progress`.
- [x] The original implementer session resumes with the review notes (not a
      fresh session).
- [x] The card re-enters `review` on completion and is re-reviewed.
- [x] The review↔fix loop is capped (~2 rounds); the count is tracked per card.
- [x] On exhausting the cap the card parks a question for the human and the
      queue skips ahead ([[c0163]] behaviour).
- [x] Unit-tested with the fake spawner (fail → resume → re-review; cap → park).

## Notes

- **Dispatch** — `planFixDispatch` in `companion/runner.ts`, planned in `sync`
  after the reviews and before the `ready` cards: a rejected card is nearly
  finished work, so it outranks starting a new one for the same reason a review
  does. AFK only, like the review that produced the verdict.
- **`needsFix` is `needsReview`'s mirror**, read off the card: a `review` card
  whose latest verdict is a `fail` stamped *after* it entered `review`. Both
  guards from [[c0167]] carry over — unreadable stamps mean nothing to do, and
  an in-process set (`fixAttempted`, cleared when the card leaves `review`)
  covers a fix run that died before moving the card, which would otherwise be
  re-dispatched on every tick.
- **The cap is counted off the card**: `fixRounds` is the number of `fail`
  entries in `## Review`. No new state, so it survives a companion restart and
  cannot drift from what the human reads. Two rounds.
- **Kind `fix`** joins `implement` / `review` on `RunKind`, but keys to the
  *implementer's* session — the point of the loop is that the context is still
  there. It therefore holds the epic session under `scope: epic`, and waits when
  a sibling holds it. An answered park resumes it as `implement`, so the resume
  gets the answered-question prompt rather than the verdict it has already read.
- **`in-progress` and back to `review` are the agent's moves** (`set_status`,
  per the prompt) — the companion still never moves a card.
- **The cap park is the one question the companion writes itself.** The loop
  ends with no agent running, so there is nobody to call `add_question`; it
  writes the `gelloquestion` block through the shared `withQuestionAdded`. The
  card keeps its `review` status and its verdicts, and the verdict is quoted so
  its bullets cannot read as answer options. A park starts nothing, so the queue
  goes past it, and answering resumes the implementer through the ordinary
  marker path.
- **A card the companion never implemented is left alone** — there is no session
  to resume, and a fresh one would re-implement the card from its criteria
  rather than fix it. Reported in the held-back line.

## Log

- 2026-08-08 created from the e08 AFK-mode breakdown ([[c0161]])
- 2026-08-08 status → ready (app)
- 2026-08-09 status → in-progress (agent)
- 2026-08-09 fix loop in `companion/runner.ts` (`needsFix`, `planFixDispatch`,
  `buildFixPrompt`, the cap park), `fixRounds` in `companion/review.ts`, `fix`
  run kind in `sessions.ts`; documented in companion/README.md; 30 tests
- 2026-08-26 status → review (app)
- 2026-08-26 status → done (app)
