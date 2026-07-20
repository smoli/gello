# gello-companion

A Node CLI that watches a gello board and runs an agent on each card entering
`ready`. It reuses the board core in `src/lib` and publishes a state file the
desktop app reads.

```bash
pnpm companion [dir]     # watch the board found from dir (default: cwd)
```

Configuration is environment-only:

| Variable | Default | Meaning |
| --- | --- | --- |
| `GELLO_COMPANION_AGENT` | `claude` | Backend: `claude` or `pi`. |
| `GELLO_COMPANION_SCOPE` | `card` | One session per `card` or per `epic`. |
| `GELLO_COMPANION_PERMISSION_MODE` | `auto` | Claude's `--permission-mode`. A headless run cannot answer an approval prompt, so `default` makes every write fail. |

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

## The resume protocol

The `awaiting` frontmatter field carries the whole protocol, and it lives on
disk, so a companion that was not running when the human answered still picks
it up on its next start:

| Value | Meaning |
| --- | --- |
| `input` | Parked. The question block is present, waiting on the human. |
| `answered` | The human answered. The companion resumes the session, then clears the field. |
| absent | Nothing pending. |

Answering un-fences the block in place, so the resolved exchange stays on the
card as ordinary markdown.
