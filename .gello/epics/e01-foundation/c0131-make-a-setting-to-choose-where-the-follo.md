---
id: c0131
title: Make a setting to choose where the follow up card should go
status: in-progress
ref: c0118
epic: e01
created: 2026-07-23
updated: 2026-07-23
status-changed: 2026-07-23T20:08:40
awaiting: input
---

```gelloquestion
Before I wire up c0131's UI, I need a call from you — the workspace is red from work that isn't this card, and I can't commit c0131 green through it.

**What I found (verified, not guessed):**
- **HEAD (`4bea41c`) already fails `pnpm typecheck`.** `Board.tsx` has half-wired c0121 hover code — `hoveredPath` / `revealFollowUp` / `onHover` never reach `CardFront` (3 errors). The committed main branch is red.
- **The working tree adds uncommitted, in-progress c0132 work** ("fix duplicate ids") in `App.tsx` + `board.ts` — it references `duplicateIdOf`, `reassignCardId`, `handleRepairDuplicateId` that aren't exported yet (3 more errors). Not mine, and not finished.

**Where c0131 stands:** the whole non-UI layer is done and green on its own — `board.yaml` `followup_target` config, `createFollowUpFor(..., status)`, `FOLLOWUP_TARGET_COLUMNS`, 141 lib tests passing. What's left is the Settings menu item and the "Ask" column-picker popup, which have to go into `App.tsx` and `Board.tsx` — the two files that are already broken. So I can't reach a green suite to honor "never commit red."

I won't finish or commit someone else's unfinished feature silently, and I won't commit red. How do you want me to proceed?

- [ ] **I complete the c0121 Board.tsx threading** (it's my own earlier work — a ~3-line fix to pass `revealFollowUp`/`onHover` down to `CardFront`), **`git stash` the uncommitted c0132 App.tsx/board.ts work** so I build on a green base, finish c0131, and commit it. You'd `git stash pop` to get c0132 back. *(my recommendation — unblocks everything, touches no unfinished c0132 logic)*
- [ ] **Commit only the green c0131 lib slice now** (cards.ts, board-actions.ts + tests) and leave the UI for a follow-up once the tree is green. Note: a checkout of that commit is still red because HEAD's Board.tsx is broken, so this doesn't really satisfy "never commit red" either — it just banks the lib work.
- [ ] **Leave c0131 as-is (lib work uncommitted on disk); you'll get the tree green first** (finish/park c0121 and c0132), then resume me.
- [ ] Something else (say what)
```

* Inbox
* Discuss
* Backlog
* Ready

as a last option: Ask

Ask will open a popup for the user to decide the column

Setting available in the settings menu of the context menu

## Notes

Design settled (see the card body + acceptance criteria below):

- Persist in `board.yaml` as `followup_target` (a column name or `ask`),
  surgical write like `show_tags`; default `ready` preserves c0115.
- Offer the four named columns that the board actually has, plus `Ask`.
- `Ask` opens a small column-picker popup, then the draft targets that column.
- The draft note reflects the real target — the "a companion will start on it"
  line only when the target is `ready`.

**Done and green in isolation** — the whole non-UI layer:

- `BoardConfig.followupTarget` + `parseBoardConfig` reads `followup_target`.
- `createFollowUpFor(..., status)` and `createRefCardFor(..., statusOverride)`.
- `FOLLOWUP_TARGET_COLUMNS` in board-actions.
- Tests in cards / board-actions / boardyaml — 141 lib tests pass.

**Blocked on a red workspace that is not this card's** (see the question):
the UI wiring must go into `App.tsx` and `Board.tsx`, and both are already
broken before I touch them, so I cannot reach a green `pnpm test` / `typecheck`
to commit against "never commit red".

## Log

- 2026-07-23 status → in-progress (agent)
- 2026-07-23 blocked (agent): finished the c0131 lib layer (config +
  createFollowUpFor target, 141 lib tests green) but the workspace is red from
  unfinished work outside c0131 — HEAD's Board.tsx (c0121 hover threading) and
  uncommitted c0132 duplicate-id work in App.tsx/board.ts. Asked the human how
  to proceed.
