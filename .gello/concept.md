# gello — Concept

A local, Markdown-native Kanban board for agentic software development.

## 1. Problem

Agentic development (Claude Code & co.) works best with a written concept that gets
broken down into epics and implementation steps. Today this lives in Markdown
files — and those files rot:

- The plan file grows into a huge, cluttered junk drawer.
- New ideas arrive constantly during development and get appended wherever.
- Status ("what is done, what is in progress, what should the agent do next?") is
  implicit prose, not structure.
- Telling the agent "work on X next" means editing free-form text and hoping it
  parses your intent.

## 2. Idea

Keep everything as Markdown files — but give each unit of work its own file with
structured frontmatter, and render them as a Kanban board in a desktop app.

- **Concept** → broken down into **epics** → broken down into **cards**.
- Every epic and every card is one `.md` file.
- A card's board column is its `status` field in the frontmatter.
- Moving a card on the board = a one-line frontmatter edit.
- The agent interacts with the board by doing what it already does best:
  reading and editing Markdown files, following a documented convention.
- Telling the agent to pick something up = dragging a card to **Ready**.

## 3. Principles

1. **Files are the single source of truth.** The app owns no state. No database,
   no sidecar index, no hidden cache that can diverge. Delete the app, keep the board.
2. **The board lives in the repo.** It's versioned with the code, travels with
   branches, and shows up in PRs. The app is a viewer you point at any repo.
3. **Human-editable, agent-editable.** Every file must be pleasant to read and
   write in an editor, by hand or by agent. No generated blobs.
4. **Convention over integration.** V1 needs zero agent-side tooling — just a
   documented convention (a `CLAUDE.md` snippet / skill) that any agent can follow.
5. **Ideas are cheap to capture.** Getting a new idea onto the board must take
   seconds, without deciding an epic up front.

## 4. Domain model & file layout

```
<repo>/
  .gello/
    board.yaml                  # board config: columns, WIP limits, settings
    concept.md                  # the product concept (long-form, stable)
    assets/                     # attachments, keyed by card ID
      c003/
        drag-drop-bug.png
    epics/
      e01-core-parser/
        epic.md                 # goal, scope, definition of done
        c001-tokenizer.md       # cards, flat within their epic
        c002-ast-builder.md
      e02-board-ui/
        epic.md
        c003-kanban-view.md
    cards/                      # epic-less cards; a new capture lands here
      c004-typo-in-tooltip.md   #   with status: inbox
  CLAUDE.md                     # includes the gello agent convention
```

A card's **location is purely its epic assignment** — two homes:

- **`cards/`** — no epic (unassigned). A freshly captured idea lands here with
  `status: inbox`; bugs and small standalone changes live here too. First-class,
  not a lesser bucket.
- **`epics/eNN-name/`** — assigned to an epic (a large effort broken into
  dependent steps). The folder *is* the membership.

**Inbox is a status, not a folder** (the first column): an unprocessed card has
`status: inbox` and lives in `cards/` (or, once assigned, in its epic). Moving a
card back to inbox is a plain status change — no file move. Location (assignment)
and status (workflow stage) are orthogonal, so an epic-assigned card can still be
`status: inbox`.

**Epics** replace the earlier *milestone* concept: same single-container folder
model, but named for what it is — an effort broken into steps, not a deadline.
**Tags** (`tags:` on a card) are the separate, cross-cutting axis — a card has
at most one epic but any number of tags, so a theme like `ui` or `perf` can span
epics and standalone cards alike. Epics are the *container* axis (one per card,
with a charter in `epic.md`); tags are the *label* axis (many per card, no
charter). On the board each tag shows as a coloured chip on the card front, a
multi-select tag filter narrows to cards carrying any selected tag (composing
with the epic, type, and search filters), and a tag manager assigns a tag's
colour and renames it everywhere it appears. Colours are per-tag overrides in
`board.yaml` (`tag_colors:`); a tag with no override gets a stable colour from
its name.

Notes:

- Files never move when status changes (stable links, clean diffs). Optional:
  an archive action moves long-done cards to `archive/` to keep folders small.
- **Capture** creates a card in `cards/` with `status: inbox`; triage (assign to
  an epic, refine) happens later on the board.
- IDs are per-board sequential and part of the filename → stable references
  in commits, card bodies (`depends on c002`), and conversation. Tasks live
  in the `c` namespace (`c001`), issues in the `i` namespace (`i0001`);
  existing IDs never change — only new cards allocate from their namespace.

### Card format

```markdown
---
id: c003
title: Kanban view with drag & drop
status: ready            # discuss | backlog | ready | in-progress | review | done
type: issue              # optional; default task; allowed values from board.yaml types
ref: c001                # optional; card this issue was found in (provenance, not dependency)
epic: e02                # optional; the epic this card belongs to (its folder is epics/e02-*); absent → standalone in cards/
depends: [c001]
tags: [ui]
order: 15                # optional; manual rank in backlog/ready (fractional; unranked cards sort last)
status-changed: 2026-07-16T14:32:07  # optional; when the current status was assigned (in-progress/review/done order by it)
created: 2026-07-16T09:00:00          # date or ISO datetime; new cards stamp the time
updated: 2026-07-16
---

## What

Render all cards as a Kanban board grouped by status; drag & drop writes
the `status` frontmatter field.

## Acceptance criteria

- [ ] Columns come from board.yaml
- [ ] Drag & drop persists within 100 ms
- [ ] External file edits appear without reload

## Notes

(Agent appends implementation notes, decisions, and blockers here.)

![Drop indicator renders in wrong column](../../assets/c003/drag-drop-bug.png)

## Log

- 2026-07-16 created from concept breakdown
```

### Attachments

- Attachments (screenshots first and foremost) live in `.gello/assets/<card-id>/`,
  referenced from the card body as normal relative Markdown image links — so they
  render on GitHub and in any editor, not just in the app.
- Keying by card ID means: a card's images are trivially findable, cleanup on
  card deletion is one folder removal, and links survive status changes.
- Moving a card between `cards/` and an epic changes its folder depth; whoever
  moves the card (app or agent) rewrites the relative link prefix. This is a
  mechanical step covered by the convention. (Assigning/unassigning is the only
  move; a status change — including to/from inbox — never moves the file.)

### Epic format

```markdown
---
id: e02
title: Board UI
status: in-progress      # derived-ish; agent/human keeps it roughly current
---

## Goal
...

## Definition of done
...
```

An `eNN` id in the `e` namespace, matching the folder name (`epics/e02-board-ui/`).
Legacy `mNN` milestone-format boards are gated on open and convert to the epic
format via a one-click, recoverable migration (new tree written before the old
is removed).

### board.yaml

```yaml
columns: [inbox, discuss, backlog, ready, in-progress, review, done]  # default lineup
types: [task, issue]     # optional; card types, open set; default [task, issue]
background: assets/board/bg.jpg  # optional; full-image board background
wip_limits:
  in-progress: 2       # optional; the board warns, agents respect it
```

The `discuss` column is a triage stage: the human flags a card (typically a
raw inbox idea) for a structured conversation with an agent; the discussion's
outcomes are written back into the card, which then graduates to an epic.

**Card order within a column** (c056) is per-column:

- **inbox** and **discuss** — by `created`, oldest on top (a capture queue;
  the inbox column is not manually rearrangeable).
- **backlog** and **ready** — manual: the user drags to insert, persisted as
  a fractional `order` rank on the moved card. Unranked cards (e.g. just
  created by an agent) sort after ranked ones, by `created`/id.
- **in-progress**, **review**, **done** — by `status-changed`, earliest on
  top (the order work entered the stage). Missing `status-changed` falls back
  to `updated` → `created` → id.

The manual `order` in backlog/ready *is* the priority signal (i0025 removed the
`priority` field). Timestamps are local-time ISO (`YYYY-MM-DDTHH:MM:SS`),
sortable as plain strings.

## 5. The agent workflow (convention)

Shipped as a Markdown snippet for `CLAUDE.md` (or a skill). The contract:

**Breakdown**
- "Break down the concept": agent reads `concept.md`, creates epic folders
  and cards with `status: backlog`.

**Signal to work**
- The human moves cards to **ready** (this is the "go" signal — the board *is*
  the prompt queue).
- "Pick up the next card": agent takes the top `ready` card (the manual
  `order`) whose `depends` are all `done`, sets `status: in-progress`, and
  starts.

**During work**
- Agent appends decisions/blockers to the card's **Notes**, checks off
  acceptance criteria, adds **Log** lines with dates.
- Commits reference the card ID (`c003: implement drag & drop`).

**Finish**
- Agent sets `status: review`; human reviews, moves to `done` (or back with
  feedback in Notes).

**New ideas**
- Human (or agent!) drops a new `.md` into `cards/` with `status: inbox` anytime
  — one heading and a sentence is enough. It shows in the inbox column; triage
  later.

## 6. The desktop app

Tauri 2 shell, web frontend (TypeScript). The app is a **reactive renderer**
of the file tree:

### MVP

- Open a repo (folder picker + recent projects), detect `.gello/`.
- Initialize a board in a repo that has none (scaffold + CLAUDE.md snippet).
- Kanban view: columns from `board.yaml`, cards grouped by status,
  swimlanes or filter by epic.
- Drag & drop → atomic frontmatter write.
- Card detail: rendered Markdown, inline editing. Task-list checkboxes render
  read-only (i0107); a task's state is changed by editing the body.
- **Screenshots from day one**: paste an image from the clipboard (or drag a
  file) into a card → app saves it to `.gello/assets/<card-id>/` and inserts
  the Markdown link; images render inline in the card detail, and cards with
  images show a thumbnail on the board.
- Quick capture: global "new idea" input → file in `cards/` with `status: inbox`.
- File watcher: agent edits appear live on the board (this is the magic moment —
  watching cards move while the agent works).
- Markdown fallback guarantee: everything degrades gracefully to plain files.

### Later (explicitly not MVP)

- Git awareness: show commits/branch linked to a card by ID.
- Dependency graph view.
- Optional MCP server / CLI for stricter validation (`gello move c003 ready`).
- Launch the agent from the app ("run Claude on this card").
- Metrics: cycle time, throughput per epic.
- Multi-board overview across projects.

## 7. Tech stack

- **Tauri 2** (Rust shell): small binary, native FS access + `notify` file
  watcher, clipboard image access for paste-to-attach.
- **Frontend**: React + TypeScript + Vite (Svelte acceptable alternative).
- **Parsing**: frontmatter via the `yaml` package (frontend) — keeps the Rust
  layer thin (FS read/write/watch only). Writes are surgical line edits, never
  YAML dumps, to preserve formatting and comments byte-for-byte.
- **Drag & drop**: `@dnd-kit` or `pragmatic-drag-and-drop`.
- **No backend, no DB.**

## 8. Risks & open questions

- **Concurrent writes** (human edits a card in the app while an agent edits the
  same file). Policy (c015): app state is always derived from disk; the only
  transient state is the active field edit. No edit silently overwrites newer
  disk content, in either direction:
  - **Surgical edits** (drag/status/field — one field)
    are *rebased on the current disk bytes before writing*, so an unrelated
    external change survives: the status comes from the app, the body from disk
    (field-level last-write-wins). No path lets a stale in-memory card clobber
    newer disk state.
  - **Full body edits** (the inline editor replaces the whole body, which can't
    be merged): if the file changed on disk since the edit began, the user is
    prompted — **Overwrite** or **Discard my edit** (keep disk) — never a silent
    write.
  - The file watcher reconciles external changes into the model continuously;
    the app never holds unsaved state beyond a single active field edit.
- **Frontmatter drift** (agent writes invalid YAML / unknown status): board
  shows a "needs attention" lane for unparseable cards instead of hiding them.
- **How much structure is too much?** Keep frontmatter minimal; resist adding
  fields until a real workflow needs them.
- Naming: `.gello/` vs visible `gello/` folder — hidden keeps repos clean,
  visible aids discoverability. (Currently: hidden.)
