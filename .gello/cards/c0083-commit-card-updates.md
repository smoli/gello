---
id: c0083
title: commit card updates
status: review
created: 2026-07-18
updated: 2026-07-18
status-changed: 2026-07-18T12:01:46
---

Updating cards pollutes the worktree and needs discipline by the user to commit. Agent’s normally commit before review, which is fine. But that would be needed another trigger by the user for the agent to commit after review or a manual commit.

## What

The app **auto-commits board changes**. Every card move or edit (the app's
own writes, plus post-review moves like a human dragging a card to `done`,
and manual card edits) currently piles up as uncommitted worktree noise that
someone has to remember to commit. Instead, the app commits `.gello/`
changes itself — no discipline required, and no separate agent/user trigger
after review.

Key properties:

- **`.gello/`-only, safely partial.** The commit contains only board files;
  the user's other staged or unstaged code changes are never swept in. This
  is a pathspec commit (`git commit -- .gello/…` after staging just the
  board paths), so a half-finished code change in the index survives
  untouched — this is the load-bearing safety property.
- **Debounced/batched.** A burst of card moves (dragging several cards, a
  reorder) collapses into one commit after the writes settle. The window
  **defaults to 30s and is itself a setting**.
- **Opt-in, project-scoped settings.** Auto-committing on the user's behalf
  is opinionated, so it's **off by default** and enabled **per project**
  (not a global toggle) — same idea as the per-project skills-dismissed flag.
  The debounce window is a setting too.
- **Rich, structured commit message.** The message lists each changed card by
  id + title with the specific changes (content update, status/epic/tag
  transitions) — see the format below.
- **Flush on close.** Any pending (debounced) board changes are committed
  before the app quits, so the last batch is never left uncommitted.
- **Never auto-push.** Commits stay local; pushing remains the user's.

**Commit message format** — a subject plus a per-card block:

```
board: N cards updated

c0042: Auto Commit Board Changes
- content update
- status backlog → review
- epic none → data-consistency

c0083: Commit card updates
- status discuss → ready
```

Each card block lists only the kinds that changed: **content update** (body
changed), **status old → new**, **epic old → new**, **tags** added/removed.
The diff is the net change since the last commit (git HEAD vs. the worktree),
so intermediate states within the debounce window collapse to one transition.

### Dirty-worktree indicator (companion)

Show a dirty indicator in the title bar **after the branch** when the
worktree has uncommitted changes — `gello: <folder> (<branch> ●)`. Two
states, if the scoping is feasible:

- **Board-only dirty** — every uncommitted change is inside `.gello/`: one
  indicator (e.g. a hollow/subtle dot), meaning "board has changes not yet
  committed to git".
- **Worktree dirty (includes code)** — there are uncommitted changes outside
  `.gello/` too: a distinct indicator (different glyph/colour).

Clean worktree → no indicator. Detection is `git status --porcelain`: empty
= clean; every changed path under `.gello/` = board-only; otherwise = full.
Shares the Rust git plumbing with the commit above (this is a read; that's a
write). With auto-commit on, the board-only state clears itself quickly, so
the indicator is most useful with auto-commit off or when code is dirty.

## Acceptance criteria

- [x] A **per-project** setting enables/disables auto-commit; **off by
      default**; a second per-project setting sets the debounce window
      (default 30s). Both are **app-local flags keyed by project path** (like
      skills-dismissed) — they don't live in `board.yaml` and don't travel
      with the repo
- [x] When enabled, after `.gello/` writes settle (debounced), the app makes
      a git commit containing **only** `.gello/` changes — including newly
      created cards — leaving any staged/unstaged code changes untouched
      (pathspec commit; the user's index is preserved)
- [x] No commit is made when there is nothing pending under `.gello/`
- [x] The app skips auto-commit (no error, no commit) when the project is not
      a git repo, or the repo is mid-merge/rebase/cherry-pick
- [x] The commit message follows the per-card format: a subject line plus one
      block per changed card (`<id>: <title>` + the kinds that changed —
      content update, status/epic/tag transitions), diffed net since HEAD
- [x] A burst of rapid board writes yields one commit, not one per write
- [x] Pending changes are flushed (committed) on app close (implemented via Tauri onCloseRequested; runtime-only, manual-verify)
- [x] A failed commit surfaces non-fatally and never blocks the board or
      loses the pending changes
- [x] The title bar shows a dirty indicator after the branch when the
      worktree has uncommitted changes; nothing when clean; no indicator in a
      non-git project
- [x] Board-only dirtiness (all changes under `.gello/`) shows a distinct
      indicator from dirtiness that includes non-board (code) changes
- [x] The indicator updates live — board writes via the existing watcher;
      code-side changes on the git-status refresh cadence

## Discussion

- **`.gello/`-only via a pathspec commit is the safety crux**: the real risk
  is sweeping the user's in-progress code changes into a "board update"
  commit. `git commit -- .gello/` commits only the board paths and ignores
  other staged content, so a mid-edit index survives. New cards are untracked
  until staged, so the flow stages just `.gello/` first, then pathspec-commits.
- **Auto over a manual button or agent trigger** (user's call): the whole
  point is removing discipline. It also obsoletes the "trigger the agent to
  commit after review" gap the card describes — the app just handles it.
- **Debounced, 30s default, configurable**: batching avoids a commit per
  drag; 30s is a starting value, exposed as a per-project setting to tune.
- **Opt-in, per-project, never push**: off by default and scoped to the
  project (not global) — you might want it on for one repo and not another.
  It never pushes; local commits only, the user pushes deliberately.
- **Rich message from the net diff**: the message is built from HEAD-vs-
  worktree for `.gello/`, so it describes the *net* change per card
  (backlog→review, not backlog→ready→review) and the kinds that changed —
  content, status, epic, tags — each labelled by card id + title. More useful
  history than a bare "board update", at the cost of frontmatter/body diffing.
- **Flush on close**: pending debounced changes commit before quit, so the
  30s window never silently drops the last batch.
- **Complements agent commits**: an agent still commits its code + the card
  at review time; the app's auto-commit covers the app-made moves (→ done)
  and manual board edits that happen outside an agent's work. No conflict —
  different moments, and the pathspec keeps them from colliding with staged
  code.
- **New Rust**: needs a thin Rust command to run `git` (stage `.gello/`,
  pathspec-commit) — the Rust layer already reads `.git/HEAD` for the branch
  (c0057); this adds the commit.
- **Dirty indicator folded in here**: it reads git state (via
  `git status --porcelain`), the same Rust git plumbing the commit needs, and
  it lives in the title next to the branch — so it belongs with this card,
  though it's separable if the implementer prefers. The `.gello/`-scoped
  distinction is a path-prefix check on the porcelain output. Live refresh:
  the board watcher already catches `.gello/` changes; code-side dirtiness
  needs the git-status re-read on the branch/`.git` watch cadence (plus,
  optionally, a light poll) — an implementation detail, and the scoped state
  degrades gracefully to a single "dirty" mark if scoping proves fiddly.
- **Settings are app-local, keyed by project path** (settled): not
  `board.yaml`. Auto-commit is a personal, per-machine workflow preference,
  not board content — putting it in `board.yaml` would commit it, force it on
  everyone who opens the board, and be circular (the auto-commit setting
  committed by auto-commit). App-local matches the existing skills-dismissed
  flag. Trade-off accepted: opening the board on another machine starts with
  it off until re-enabled.
- **Open**: none — scope and behaviour are settled.

## Log

- 2026-07-18 status → discuss (app)
- 2026-07-18 discussed (agent): app auto-commits `.gello/`-only changes via a
  pathspec commit (never touches the user's code index), debounced, behind an
  opt-in setting, never pushes; obsoletes the post-review commit trigger
- 2026-07-18 open questions resolved (human): opt-in + per-project setting;
  debounce 30s default + configurable; rich per-card message (content/status/
  epic/tag by id+title, net diff); flush on close.
- 2026-07-18 settled (human): the per-project settings are app-local flags
  keyed by project path (not board.yaml).
- 2026-07-18 added (human): dirty-worktree indicator in the title after the
  branch, with a distinct mark when the dirtiness is board-only (`.gello/`)
  vs. includes code — shares the git plumbing, separable if wanted.
- 2026-07-18 status → ready (app)

## Log

- 2026-07-18 implemented (agent), in 4 green slices:
  1. Rust `commit_board` (pathspec `.gello/` commit — code index preserved,
     the safety crux), `worktree_status` (board-vs-code), `board_changes`
     (HEAD+worktree per changed file). Real-git cargo tests incl. staged-code-
     survives.
  2. Pure `buildCommitMessage` (net per-card diff; Log churn ignored; reorder
     catch-all).
  3. App orchestration: per-project app-local flags (auto-commit off by
     default, 30s window), debounced commit armed by the file watcher, flush
     on close, non-fatal failure, Settings-menu toggles.
  4. Title-bar dirty indicator (hollow board-only vs filled/orange code),
     live via the board + git-HEAD watchers.
  Flush-on-close is Tauri-runtime only (not unit-tested) — verify manually.
  480 frontend + 41 Rust tests, typecheck, lint all green.
