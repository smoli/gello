# CLAUDE.md — gello

gello is a local, Markdown-native Kanban board for agentic software development.
Markdown files in `.gello/` are the single source of truth; the desktop app
(Tauri 2 + React/TypeScript) is a reactive renderer of that file tree.
Read [.gello/concept.md](.gello/concept.md) before making design decisions —
it is the authoritative product spec.

## Tech stack

- **Shell**: Tauri 2 (Rust). Keep the Rust layer thin: FS read/write/watch,
  clipboard image access. No business logic in Rust unless it must be there.
- **Frontend**: React + TypeScript (strict mode) + Vite.
- **Parsing**: the `yaml` package (browser-clean, no Buffer polyfill needed in
  the webview). YAML is only ever *parsed* — writes are surgical line edits on
  the raw text so untouched lines (formatting, comments, unknown fields)
  survive byte-for-byte. Never dump/stringify YAML.
- **Unit/component tests**: Vitest + React Testing Library.
- **Rust tests**: `cargo test` in `src-tauri/`.
- **E2E**: Playwright against the Vite dev build (Tauri APIs mocked at the
  boundary); full Tauri e2e only where FS behavior is the thing under test.

## TDD is mandatory

This is not a preference. It is the workflow.

1. **No production code without a failing test first.** Write the test, run it,
   watch it fail for the right reason, then implement.
2. **Red → Green → Refactor.** Make it pass with the simplest thing that works,
   then clean up with tests green.
3. **Bug fixes start with a reproducing test.** No fix lands without a test
   that failed before the fix and passes after.
4. **Acceptance criteria on a card map to tests.** When picking up a card,
   translate its acceptance criteria into test cases first — they are the spec.
   If a criterion is untestable, that's a card problem: flag it in the card's
   Notes before writing code.
5. **Never commit red.** All tests pass before every commit. No skipped or
   `.only` tests in committed code.
6. **Don't weaken a test to make it pass.** If a test seems wrong, say so and
   fix the test deliberately, as its own step — never silently while
   implementing.
7. What gets a test: all parsing/serialization (frontmatter round-trips!),
   board logic (grouping, moving, dependency checks, WIP limits), file-watcher
   reconciliation, and every Rust command. Pure UI layout/styling does not need
   tests; behavior wired to it does.

Untested code is not "done" — a card cannot move to `review` without its tests.

## Commands

Keep this section current as the project scaffolds up.

```bash
pnpm test            # run all frontend tests once
pnpm test:watch      # Vitest watch mode — keep it running during TDD
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint (enforces the fs.ts / cards.ts layer bans)
cd src-tauri && cargo test   # Rust tests
pnpm tauri dev       # run the app
```

"Never commit red" includes lint: test, typecheck, and lint must all pass
before every commit.

## Code conventions

- TypeScript `strict`; no `any` unless quarantined at an untyped boundary with
  a comment.
- Frontmatter I/O goes through one module (`src/lib/cards.ts` or equivalent) —
  never parse or write card YAML ad hoc elsewhere.
- All file writes must be atomic (write temp, rename) — an agent or the user
  may be watching/reading the same file.
- Never hold unsaved editor state longer than a single field edit; the file
  watcher may bring external changes at any time.
- Card/milestone types live in one shared types module; the schema in
  CONCEPT.md §4 is the contract.

## Working the gello board (dogfooding)

gello is developed using its own format. The board in `.gello/` is the plan —
do not maintain parallel plan/TODO files.

- **Query the board** (cheap, one grep each — never read all cards to find one):
  ```bash
  # cards by status (card files are c*.md with a numeric id; this glob
  # excludes concept.md and milestone.md)
  grep -rl "^status: ready" .gello/inbox .gello/milestones --include="c[0-9]*.md"
  # status overview
  grep -rh "^status:" .gello/inbox .gello/milestones --include="c[0-9]*.md" | sort | uniq -c
  # one card's frontmatter at a glance
  sed -n '/^---$/,/^---$/p' <card-file>
  ```
- **Pick up work**: ALWAYS re-query the board from disk first (the status
  grep above) — never act on remembered board state. The human moves cards in
  the app between turns, and app writes are silent; disk is the only truth.
  Then take the highest-priority card in `ready` whose `depends` are all
  `done`, and set `status: in-progress` before starting.
- **During work**: append decisions and blockers to the card's `## Notes`,
  check off acceptance criteria as their tests pass, add dated `## Log` lines.
- **Finish**: set `status: review`. Only a human moves cards to `done`.
- **New ideas**: create a card in `.gello/inbox/` — a heading and a sentence is
  enough. Never bloat an existing card with unrelated scope.
- **Discuss** (`status: discuss`): the human flags a card they want to think
  through with you before it becomes implementable — typically an inbox idea
  before triage. When asked to discuss (or picking work and only discuss
  cards are flagged): read the card, then *interview the human* — goal,
  scope, constraints, edge cases, what done looks like. Write the outcomes
  back into the card: a refined `## What`, drafted `## Acceptance criteria`,
  and a compact `## Discussion` section (key decisions, rejected
  alternatives, open questions — no verbatim transcript). Find candidates:
  `grep -rl "^status: discuss" .gello/inbox .gello/milestones --include="c[0-9]*.md"`.
  Exit is the human's call: triage to a milestone / `backlog` / `ready`.
- **Attachments**: store under `.gello/assets/<card-id>/`, link with relative
  Markdown image paths. When moving a card file between folders, rewrite its
  relative asset links.
- **Frontmatter discipline**: valid YAML, only statuses from `board.yaml`.
  If you find a malformed card, fix the YAML, don't discard content.

## Commits

- Reference the card ID: `c003: implement drag & drop persistence`.
- Small, green commits over big ones. Test and implementation of a behavior
  belong in the same commit.
