---
id: c0107
title: Companion asks the agent to commit (policy stays with CLAUDE.md)
status: done
epic: e08
created: 2026-07-20
updated: 2026-07-20
status-changed: 2026-07-20T18:33:20
---

## What

Every companion run ended with a variant of "I didn't commit — you didn't ask",
leaving the work uncommitted. Running the companion on gello itself piled up a
whole tree of uncommitted card work.

The suspicion was that companion sessions don't pick up `CLAUDE.md`. They do —
a headless run quotes it back ("reference the card ID", "never commit red"),
both of which exist only in `CLAUDE.md`. The real cause is two things meeting:

- the agent harness's own default: commit or push only when the user asks
- the companion's task prompt, which pointed at `CLAUDE.md` but never asked for
  a commit

The companion is the delegating user in this setup, so it has to ask.

**It states no policy of its own.** The companion runs against any project, so
whether to branch, what to include, the message format, and when to commit are
the repo's business — `CLAUDE.md` is the authority. The prompt grants the
authorization and gets out of the way. Pushing stays off, per the epic rule
that the companion never pushes.

## Acceptance criteria

- [x] Both the fresh and the resume prompt authorize committing
- [x] The prompt defers when/what/format to the repo's `CLAUDE.md`
- [x] The prompt forbids pushing
- [x] The prompt invents no policy of its own (no branching or message-format
      rules) — covered by a test
- [x] Verified end to end against a repo whose `CLAUDE.md` has a distinctive
      convention: the agent committed, used that prefix, and committed only the
      file it changed, leaving an unrelated dirty file untouched

## Discussion

- **Defer to `CLAUDE.md`** (human's call): the companion is generic, so
  hard-coding a commit policy would be wrong for every other project.
  Rejected: branch-per-card, and a companion-owned message format.
- **Never push** stays a companion-level floor rather than a per-repo choice.
- The deferral is load-bearing: in the verification the agent honored the test
  repo's "commit only the files you changed, never `git add -A`" rule, which is
  what keeps a companion run from swallowing an unrelated dirty tree.

## Log

- 2026-07-20 raised from running the companion on gello itself; diagnosed
  (CLAUDE.md loads fine; the prompt never asked), fixed, and verified in a
  throwaway repo. status → review
- 2026-07-20 status → done (app)
