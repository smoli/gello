// Board initialization (c017): scaffold a fresh `.gello/` tree and the
// CLAUDE.md convention snippet. Pure — the caller does the writes.

export interface ScaffoldFile {
  path: string;
  content: string;
}

const BOARD_YAML = `columns: [inbox, backlog, ready, in-progress, review, done]
types: [task, issue]
wip_limits:
  in-progress: 2
`;

const CONCEPT_MD = `# Concept

The product concept lives here — the authoritative spec that epics and
cards are broken down from. Replace this with yours (or fold in an existing
vision doc).
`;

/** Files to create for a fresh board under `projectRoot`. */
export function scaffoldFiles(projectRoot: string): ScaffoldFile[] {
  const gello = `${projectRoot}/.gello`;
  return [
    { path: `${gello}/board.yaml`, content: BOARD_YAML },
    { path: `${gello}/concept.md`, content: CONCEPT_MD },
    { path: `${gello}/assets/.gitkeep`, content: "" },
    // c0088: no inbox/ folder — inbox is a status. epics/ for grouped work,
    // cards/ for epic-less standalone cards (a fresh capture lands here).
    { path: `${gello}/epics/.gitkeep`, content: "" },
    { path: `${gello}/cards/.gitkeep`, content: "" },
  ];
}

/** Marker identifying the gello convention block in a CLAUDE.md. */
export const CONVENTION_MARKER = "<!-- gello-convention -->";

const CONVENTION_SNIPPET = `${CONVENTION_MARKER}
## Working the gello board

This project uses **gello** — a Markdown-native Kanban board in \`.gello/\`.
The files are the single source of truth; cards are \`.md\` files with YAML
frontmatter. Read \`.gello/concept.md\` for the product spec.

- **Query the board** (never read all cards to find one):
  \`\`\`bash
  grep -rl "^status: ready" .gello/cards .gello/epics --include="[ci][0-9]*.md"
  grep -rh "^status:" .gello/cards .gello/epics --include="[ci][0-9]*.md" | sort | uniq -c
  \`\`\`
- **Pick up work**: re-query the board from disk first, then take the
  top \`ready\` card whose \`depends\` are all \`done\`; set
  \`status: in-progress\` before starting.
- **Finish**: set \`status: review\` (only a human moves cards to \`done\`).
- **New ideas**: capture a card in \`.gello/cards/\` with \`status: inbox\` — a
  heading and a sentence. (Inbox is a status, the first column — not a folder.)
- **Triage**: move a card into an epic (\`epics/eNN-name/\`) or leave it
  standalone in \`.gello/cards/\`; \`tags:\` are the separate cross-cutting axis.
- Valid statuses come from \`board.yaml\`; frontmatter must be valid YAML.
`;

/** Append the convention block to existing agent-instructions text, unless it
 *  is already present (idempotent). */
function appendConvention(existing: string): string {
  if (existing.includes(CONVENTION_MARKER)) return existing;
  const base = existing.replace(/\s*$/, "\n");
  // no leading blank line when the file was empty
  return base.trim() === "" ? CONVENTION_SNIPPET : `${base}\n${CONVENTION_SNIPPET}`;
}

/**
 * The CLAUDE.md content after adding the convention: create from scratch when
 * absent, append when present, and never add the block twice (idempotent).
 */
export function claudeMdContent(existing: string | null): string {
  if (existing === null) {
    return `# CLAUDE.md\n\n${CONVENTION_SNIPPET}`;
  }
  return appendConvention(existing);
}

/**
 * The AGENTS.md content after adding the convention. Unlike CLAUDE.md this only
 * updates an existing file — `initBoard` skips it when AGENTS.md is absent
 * (it's the cross-agent convention file; we don't presume to create one).
 * Idempotent.
 */
export function agentsMdContent(existing: string): string {
  return appendConvention(existing);
}
