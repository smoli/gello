# gello-companion

A Node CLI that watches a gello board and runs an agent on each card entering
`ready`. It reuses the board core in `src/lib` and publishes a state file the
desktop app reads. It runs headless — agents work with the GUI closed, on a
server or over SSH.

## Install

The companion ships in the gello repo and runs on [`tsx`](https://tsx.is) (a
dependency, no build step).

```bash
git clone <gello repo> && cd gello
pnpm install
```

Run it from the checkout, or link it as a global `gello-companion` command:

```bash
pnpm link --global      # then `gello-companion` is on PATH
```

## Run

```bash
pnpm companion [dir]              # from the checkout (default dir: cwd)
npx tsx companion/main.ts [dir]   # standalone, no global link
gello-companion [dir]             # after `pnpm link --global`
```

### Shipped with the app (i0118)

The desktop app does **not** use any of the above — a global link only ever
exists in a dev checkout. `pnpm build:companion` bundles the companion and every
dependency into one file, `src-tauri/companion-dist/gello-companion.mjs`, which
the Tauri build ships as an app resource. The app's **Start companion** action
runs it with the user's Node:

```bash
node gello-companion.mjs <project-dir>
```

So the app needs `node` on the PATH of the terminal it opens, and nothing else.
The bundle is a build artifact — gitignored, rebuilt by `pnpm tauri dev` and
`pnpm tauri build`.

`dir` is any path inside the project; the companion walks up to find `.gello/`,
the same way the app does. With no argument it starts from the current
directory.

## Configuration

Per-project settings live in `.gello/companion.yaml` — committed, so the
board-level workflow travels with the board. All keys are optional; an absent
file means the defaults below.

```yaml
# .gello/companion.yaml
agent: claude          # backend: claude | pi
scope: card            # one agent session per card, or per epic
trigger: ready         # the status whose entry dispatches a run
permissionMode: auto   # headless permission posture for the backend
level: normal          # run output verbosity: quiet | normal | verbose
```

| Key | Default | Meaning |
| --- | --- | --- |
| `agent` | `claude` | Agent backend: `claude` or `pi`. |
| `scope` | `card` | One resumable session per `card`, or shared per `epic`. |
| `trigger` | `ready` | The status a card enters to dispatch a run. |
| `permissionMode` | `auto` | Claude's `--permission-mode`. A headless run cannot answer an approval prompt, so `default` makes every write fail; `auto` pre-approves while honoring deny-rules. pi ignores it. |
| `level` | `normal` | Terminal verbosity for a run (see [Run output](#run-output)). |

Each key has an environment-variable override that beats the file, for
per-machine settings (e.g. which agent CLI is installed):

| Variable | Overrides |
| --- | --- |
| `GELLO_COMPANION_AGENT` | `agent` |
| `GELLO_COMPANION_SCOPE` | `scope` |
| `GELLO_COMPANION_TRIGGER` | `trigger` |
| `GELLO_COMPANION_PERMISSION_MODE` | `permissionMode` |
| `GELLO_COMPANION_LEVEL` | `level` |

Precedence is env var > `companion.yaml` > default. A malformed config file
stops startup with its path rather than falling back to a surprise backend.

Runtime state (the state file, session UUIDs) is separate and per-machine: it
lives under `.gello/.companion/`, which is gitignored.

## State file

The companion publishes its state to `.gello/.companion/state.json` after every
board change. The desktop app watches this file and renders a runner indicator
(c0100); it never talks to the companion process directly.

```json
{
  "status": "idle",        // idle | running | waiting
  "ready": ["c0042"],      // card ids sitting in the trigger status
  "waiting": ["c0031"],    // card ids parked on an unanswered question
  "runs": [                // active runs
    { "cardId": "c0042", "phase": "running" }
  ],
  "updated": "2026-07-20T09:30:00"
}
```

A run's `phase` is `running`, `waiting-for-input`, `done`, or `error`. A run
also carries `usage` (input/output/cache tokens, `totalCostUsd`, `numTurns`,
`durationMs`, `permissionDenials`) once the backend reports it — see below.

## Run output

The companion pipes the agent's stdout and parses it, rather than letting it
print raw. That gives three things at once: token and cost counts (only
available from the parsed stream), a card-id prefix on every line so two
concurrent runs stay readable, and denials made visible. The `level` setting
decides how much reaches the terminal:

| Level | Shows |
| --- | --- |
| `quiet` | The companion's own lifecycle lines only. |
| `normal` (default) | Plus one line per agent tool call and a token/cost summary when the run ends. |
| `verbose` | Plus the agent's assistant text as it streams. |

Each stream line is prefixed with its card, e.g. `[c0042] → Bash(pnpm test)`.
Parsing is owned by each backend's adapter: claude runs with
`--output-format stream-json --verbose` and its NDJSON is mapped to a
backend-neutral event stream; pi, which has no structured stream, degrades to
prefixed plain text (assistant text at `verbose`, no tool or token lines).

Independent of the level, two surfaces are always written: a run's `usage` in
`state.json` (so the app can show tokens and cost), and the full event
transcript appended to `.gello/.companion/runs.log`, for inspecting a finished
run without scrollback. Both are under the gitignored `.companion/` dir.

## Moving the card

The agent moves its own card between statuses — the companion process never
edits cards. On claude that goes through the MCP tool `set_status`, taking one
`status` argument (a board column). It stamps `status-changed`, drops a stale
manual `order`, and adds a `## Log` line, so an agent move lands on disk the
same shape as a drag-drop in the app. Like `add_question`, the tool is scoped to
the run's card via `GELLO_CARD_ID`, so an agent cannot move an unrelated card;
an unknown status is refused. pi has no MCP, so a pi agent edits the frontmatter
directly per the gello workflow.

The prompt directs the agent to call `set_status` with `in-progress` as its
first action, before any analysis — otherwise the human watches a card sit in
`ready` while the agent thinks, unsure it was picked up.

## Asking the human a question

An agent that needs a decision parks a question on the card and exits. The
human answers it in the app, and the companion resumes the same session.

The question format is never something the agent writes by hand — it calls a
tool, and the tool writes the block. Which tool depends on the backend:

- **claude** — the MCP tool `add_question`, taking one `markdown` argument. The
  companion starts the server per run and wires it in, so it needs no setup.
- **pi** — the `gello ask` command, because pi has no MCP ("No MCP. Build CLI
  tools with READMEs"):

  ```bash
  pnpm companion ask 'Which database should this use?

  - [ ] Postgres
  - [ ] SQLite'
  ```

Both write the same thing: a `gelloquestion` fenced block at the top of the
card, plus `awaiting: input` in its frontmatter. Options are `- [ ] label`
checkbox lines. Offering options does not constrain the human — every question
also takes free text, so expect an answer that picks none of them.

The card is not the agent's to pick. The companion puts the run's card id in
`GELLO_CARD_ID` when it spawns the agent, and both surfaces take the card from
there — an agent cannot park a question on an unrelated card.

Only one question can be open at a time. Asking again while one is unanswered
is refused rather than silently replacing a question the human has not seen.

### The resume protocol

The `awaiting` frontmatter field carries the whole protocol, and it is on disk,
so a companion that was not running when the human answered still picks it up on
its next start:

| Value | Meaning |
| --- | --- |
| `input` | Parked. The question block is present, waiting on the human. |
| `answered` | The human answered. The companion resumes the session, then clears the field. |
| absent | Nothing pending. |

Answering un-fences the block in place, so the resolved exchange stays on the
card as ordinary markdown.

## Launching from the app

The title bar's runner corner offers **Start companion** whenever no companion is
live for the open board; once one is running, that same spot becomes the c0100
status indicator (c0110). The app and companion coordinate only through
`.gello/` files.

Start **opens a terminal** rather than managing a child process:

```
node <app resources>/companion-dist/gello-companion.mjs <project-dir>
```

The terminal owns the process — it is where the run stream shows and Ctrl-C is
how you stop it, so closing the app leaves the companion running and the app
never kills it. Opening a login-shell terminal is also what gives the companion
the user's PATH (a GUI app does not inherit it), which is why a missing `node`
is reported by the launched script rather than by the app. A missing bundle *is*
reported in-app, since that is a packaging fault the app can see.

The app reads `.gello/.companion/state.json` to show whether a companion is
running (c0100).
