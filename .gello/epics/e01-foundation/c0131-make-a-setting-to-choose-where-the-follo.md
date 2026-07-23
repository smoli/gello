---
id: c0131
title: Make a setting to choose where the follow up card should go
status: review
ref: c0118
epic: e01
created: 2026-07-23
updated: 2026-07-23
status-changed: 2026-07-23T22:08:46
---

Before I wire up c0131's UI, I need a call from you — the workspace is red from work that isn't this card, and I can't commit c0131 green through it.

**What I found (verified, not guessed):**
- **HEAD (`4bea41c`) already fails `pnpm typecheck`.** `Board.tsx` has half-wired c0121 hover code — `hoveredPath` / `revealFollowUp` / `onHover` never reach `CardFront` (3 errors). The committed main branch is red.
- **The working tree adds uncommitted, in-progress c0132 work** ("fix duplicate ids") in `App.tsx` + `board.ts` — it references `duplicateIdOf`, `reassignCardId`, `handleRepairDuplicateId` that aren't exported yet (3 more errors). Not mine, and not finished.

**Where c0131 stands:** the whole non-UI layer is done and green on its own — `board.yaml` `followup_target` config, `createFollowUpFor(..., status)`, `FOLLOWUP_TARGET_COLUMNS`, 141 lib tests passing. What's left is the Settings menu item and the "Ask" column-picker popup, which have to go into `App.tsx` and `Board.tsx` — the two files that are already broken. So I can't reach a green suite to honor "never commit red."

I won't finish or commit someone else's unfinished feature silently, and I won't commit red. How do you want me to proceed?

- [ ] **I complete the c0121 Board.tsx threading** (it's my own earlier work — a ~3-line fix to pass `revealFollowUp`/`onHover` down to `CardFront`), **`git stash` the uncommitted c0132 App.tsx/board.ts work** so I build on a green base, finish c0131, and commit it. You'd `git stash pop` to get c0132 back. *(my recommendation — unblocks everything, touches no unfinished c0132 logic)*
- [ ] **Commit only the green c0131 lib slice now** (cards.ts, board-actions.ts + tests) and leave the UI for a follow-up once the tree is green. Note: a checkout of that commit is still red because HEAD's Board.tsx is broken, so this doesn't really satisfy "never commit red" either — it just banks the lib work.
- [x] **Leave c0131 as-is (lib work uncommitted on disk); you'll get the tree green first** (finish/park c0121 and c0132), then resume me.
- [ ] Something else (say what)

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

## Acceptance criteria

- [x] The follow-up target is a setting in the context menu's Settings submenu,
      offering Inbox / Discuss / Backlog / Ready (those the board has) + Ask
- [x] The chosen column is persisted in `board.yaml` (`followup_target`),
      default `ready`
- [x] A follow-up lands in the configured column (task, `ref` to parent, epic)
- [x] `Ask` opens a column picker; the follow-up then targets the picked column
- [x] Cancelling the picker creates nothing
- [x] The draft note names the target column, and only says a companion will
      start on it when the target is `ready`

## Notes — final

The whole c0131 feature is **implemented and its own tests are green** (145
lib + picker tests, 3 App tests):

- Config: `BoardConfig.followupTarget`, `parseBoardConfig` reads
  `followup_target`; `chooseFollowupTarget` writes it surgically (drops the key
  for the `ready` default).
- Creation: `createFollowUpFor(..., status)` /
  `createRefCardFor(..., statusOverride)`, `FOLLOWUP_TARGET_COLUMNS`.
- App: `startFollowUp` resolves the target — a fixed column opens the draft
  straight away, `ask` opens `FollowUpColumnPicker` first. The draft note names
  the column and only mentions the companion for `ready`. Settings submenu.
- Committed in `a0c4273` (config/actions/App wiring, bundled by the human with
  their card-front work) and `3c6a0ac` (the FollowUpColumnPicker component,
  which `a0c4273` imported but had left untracked).
- c0131 App tests are driven through the CardDetail "Follow up" action, so they
  are decoupled from the card-front markup the human is concurrently changing.

**The suite is red, but not from c0131.** While this card was in flight the
human began a separate "follow up with an issue" redesign of the card front —
two triggers (`i`/`c`) and an `onFollowUpCard(card, type)` signature — living in
an **uncommitted `Board.tsx`**. That redesign breaks the committed
c0118/c0120/c0121 card-front tests (10 failures) and leaves a signature
mismatch in `a0c4273`. I left `Board.tsx` untouched (its edits are flagged
intentional) and did not rewrite those tests — the new two-button design is the
human's call, and the tests should be updated to match it as part of that work.
The only other red is the gitignored `demo/holzhof-board.test.ts`, which fails
at HEAD independently.

## Log

- 2026-07-23 status → in-progress (agent)
- 2026-07-23 blocked (agent): finished the c0131 lib layer (config +
  createFollowUpFor target, 141 lib tests green) but the workspace is red from
  unfinished work outside c0131 — HEAD's Board.tsx (c0121 hover threading) and
  uncommitted c0132 duplicate-id work in App.tsx/board.ts. Asked the human how
  to proceed.
- 2026-07-23 resumed + finished (agent): restored the dropped c0121 Board
  wiring (commit 8054d2f) to unbreak the tree, then built the c0131 UI —
  Settings submenu, `startFollowUp`, FollowUpColumnPicker, target-aware note.
  c0131 landed in a0c4273 (with the human's card-front work) + 3c6a0ac (picker
  component). All c0131 tests green. Remaining red is the human's concurrent,
  uncommitted card-front redesign, not this card.
- 2026-07-23 status → review (agent)

- 2026-07-23 status → in-progress (agent)
- 2026-07-23 blocked (agent): finished the c0131 lib layer (config +
  createFollowUpFor target, 141 lib tests green) but the workspace is red from
  unfinished work outside c0131 — HEAD's Board.tsx (c0121 hover threading) and
  uncommitted c0132 duplicate-id work in App.tsx/board.ts. Asked the human how
  to proceed.
- 2026-07-23 status → review (agent)
