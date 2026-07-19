// gello skill installer (c032). Generic "install a gello-managed skill into
// detected agent-skill locations" mechanism; the discuss skill is the first
// skill. Reused by c029 (legacy onboarding) later.

// v2 (i0025): templates no longer mention the removed `priority` field
// v3 (c0081/c0082): milestone→epic vocabulary; adds the gello-plan skill
// v4 (i0034): status-changed is set by replacing, never appending
export const SKILL_VERSION = 4;

export interface SkillTemplate {
  /** Folder name under a skills dir, e.g. `.claude/skills/<folder>/SKILL.md`. */
  folder: string;
  /** SKILL.md content (frontmatter + instructions), ending with a newline. */
  body: string;
  /** Managed version; bump to ship an update. */
  version: number;
}

/** Deterministic, dependency-free content hash (djb2, base36). */
function hashBody(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i += 1) {
    h = ((h << 5) + h + content.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

const MARKER_RE = /<!-- gello-managed v(\d+) ([a-z0-9]+) -->\n?$/;

/** Full on-disk file: the body plus a trailing gello-managed marker. */
export function managedSkillFile(skill: SkillTemplate): string {
  const body = skill.body;
  return `${body}<!-- gello-managed v${skill.version} ${hashBody(body)} -->\n`;
}

export type InstallAction = "install" | "update" | "skip";

/**
 * Decide what to do with an existing SKILL.md:
 * - no file → install
 * - pristine managed file (marker hash matches its body) & older version → update
 * - pristine & current → skip
 * - user-edited (hash mismatch) or unmanaged (no marker) → skip, never clobber
 */
export function installDecision(
  existing: string | null,
  skill: SkillTemplate,
): InstallAction {
  if (existing === null) return "install";
  const match = MARKER_RE.exec(existing);
  if (!match) return "skip"; // unmanaged — a hand-written skill
  const version = Number(match[1]);
  const recordedHash = match[2];
  const body = existing.replace(MARKER_RE, "");
  if (hashBody(body) !== recordedHash) return "skip"; // user edited the body
  return version < skill.version ? "update" : "skip";
}

/**
 * i0009: given (dir, existing content, skill) entries, the dirs that have at
 * least one skill needing install or update — so the prompt only appears when
 * there is actually something to do, not on every board open.
 */
export function dirsNeedingInstall(
  entries: Array<{ dir: string; existing: string | null; skill: SkillTemplate }>,
): string[] {
  const dirs: string[] = [];
  for (const { dir, existing, skill } of entries) {
    if (installDecision(existing, skill) !== "skip" && !dirs.includes(dir)) {
      dirs.push(dir);
    }
  }
  return dirs;
}

/**
 * From the detected skill directories, the ones to install into. pi discovers
 * both `.pi/skills` and `.agents/skills`, so when both exist install only into
 * `.agents/skills` to avoid a duplicate skill; `.claude/skills` is independent.
 */
export function resolveInstallTargets(existing: string[]): string[] {
  const hasAgents = existing.some((d) => d.endsWith("/.agents/skills"));
  return existing.filter(
    (dir) => !(hasAgents && dir.endsWith("/.pi/skills")),
  );
}

/** Absolute path of a skill's SKILL.md inside a skills directory. */
export function skillFilePath(skillsDir: string, skill: SkillTemplate): string {
  return `${skillsDir}/${skill.folder}/SKILL.md`;
}

export const ONBOARD_SKILL: SkillTemplate = {
  folder: "gello-onboard",
  version: SKILL_VERSION,
  body: `---
name: gello-onboard
description: Migrate an existing project's task organisation (TODO.md, plan files, docs, issue lists) onto a gello board, preserving history. Use to onboard a legacy project to gello.
---

# Onboard a project to gello

gello is a Markdown-native Kanban board: each card is one \`.md\` file under
\`.gello/\` with YAML frontmatter. Your job is to migrate whatever planning the
project already has onto the board — **safely, completely, and only after the
human approves the plan**.

## Board format (target)

\`\`\`
.gello/
  board.yaml                 # columns: [backlog, ready, in-progress, review, done]
  concept.md                 # long-form product concept (optional)
  inbox/                     # unassigned ideas
  epics/e01-<slug>/
    epic.md                  # id, title, status
    c001-<slug>.md           # cards, flat within their epic
  cards/                     # epic-less standalone cards (bugs, small changes)
    c002-<slug>.md
\`\`\`

Card frontmatter: \`id\` (per-board sequential, \`c\`+4 digits, never reused or
duplicated), \`title\`, \`status\` (only values from board.yaml), \`epic\` (the
\`eNN\` id; omit for a standalone card in \`cards/\`), \`created\`, \`updated\`,
optional \`tags\`. Card bodies use \`## What\`, \`## Acceptance criteria\`
(\`- [ ]\`), \`## Notes\`, \`## Log\`.

## Pre-flight (do this first, always)

1. **Require a clean git working tree.** Run \`git status --porcelain\`; if it
   is non-empty, warn the human and **stop** — write nothing, create nothing.
   A clean tree makes the whole migration one reviewable, revertable diff.

## Flow: inventory → propose → confirm → write

2. **Inventory** the project's planning artifacts, format-agnostically: plan
   / TODO / roadmap markdown, task lists, \`docs/\` folders, exported issue
   lists, anything that encodes work. Do not assume a specific format.
3. **Propose a mapping** and present it for approval — this is the reviewable
   artifact, and it must be **complete** (never sampled or truncated, however
   large):
   - source structure / phases → **epics** (a small change with no phase can be
     a standalone card in \`cards/\`)
   - completed items → \`done\` cards (keeps throughput history on the board)
   - active / next work → \`ready\` at most (**never** \`in-progress\` — WIP is
     claimed by whoever actually works it)
   - ambiguous items → \`inbox\` as \`backlog\`
   List every item with its target status. For a huge backlog, write the
   proposal to a file rather than chat, but keep it complete.
4. **Confirm** — make no board writes until the human approves or adjusts the
   mapping at this single checkpoint.
5. **Write** the board: create epic folders + cards with sequential,
   unique IDs and valid frontmatter.

## History & provenance

- Recover \`created\` / \`updated\` from the git history of the source files
  where possible (\`git log --follow --format=%ad --date=short <file>\`); else
  use today.
- Every migrated card gets a \`## Log\` line citing its origin (source file /
  item / issue number).
- **Never edit, move, or delete the legacy source files.** They are read-only.

## Concept folding

- If a legacy vision / spec / design doc exists, offer to synthesize
  \`.gello/concept.md\` from it — leave the original in place.

## Finish

- Write \`.gello/migration.md\`: a list of every legacy file made obsolete by
  the migration, stating explicitly that **removing them is the human's
  decision, not yours**.
- Validate: every card parses, statuses are all from board.yaml, and no two
  cards share an id.
`,
};

export const DISCUSS_SKILL: SkillTemplate = {
  folder: "gello-discuss",
  version: SKILL_VERSION,
  body: `---
name: gello-discuss
description: Interview the human about a gello board card flagged \`status: discuss\` and write the refined outcome back into the card. Use when asked to discuss a gello card, or when picking up work and only discuss-flagged cards remain.
---

# Discuss a gello card

gello is a Markdown-native Kanban board: every card is one \`.md\` file under
\`.gello/\` with YAML frontmatter (\`id\`, \`title\`, \`status\`, \`epic\`, …).
The \`discuss\` status means the human wants to think a card through with you
*before* it becomes implementable — usually a raw inbox idea.

## Find discuss cards

\`\`\`bash
grep -rl "^status: discuss" .gello/inbox .gello/epics .gello/cards --include="[ci][0-9]*.md"
sed -n '/^---$/,/^---$/p' <card-file>   # one card's frontmatter
\`\`\`

## Flow

1. **Pick the card** — the passed card ID, else list discuss cards and ask.
2. **Read it** — the whole file: What, any existing notes, its origin.
3. **Interview the human** — one focused topic at a time: goal, scope,
   constraints, edge cases, what "done" looks like, rejected alternatives.
   Do not write anything yet.
4. **Write the outcome back into the card**, preserving untouched lines
   byte-for-byte (surgical edits, valid YAML):
   - a refined \`## What\`
   - a drafted \`## Acceptance criteria\` (each a checkable, testable line)
   - a compact \`## Discussion\` — key decisions, rejected alternatives, open
     questions. No verbatim transcript.
5. **Offer triage** — assign to an epic / \`cards/\` / \`backlog\` / \`ready\`. Only
   the human decides the exit; perform any move only on explicit confirmation.

## Triage move (only on the human's say-so)

Moving a card between folders is a file move plus a status edit:
- inbox → epic: move \`.gello/inbox/<card>.md\` to
  \`.gello/epics/<eNN-slug>/<card>.md\`, set \`epic:\`, and rewrite relative
  asset links (\`](../assets/\` → \`](../../assets/\`).
- inbox → standalone: move to \`.gello/cards/<card>.md\` (same depth, no link
  rewrite); leave \`epic\` unset.
- Set \`status\` and \`status-changed\` (local ISO datetime) on any status change,
  **replacing** the existing lines — never add a second \`status-changed:\` (a
  duplicate frontmatter key makes the card unparseable). One line per key.
- Never reuse or renumber existing card IDs.
`,
};

export const PLAN_SKILL: SkillTemplate = {
  folder: "gello-plan",
  version: SKILL_VERSION,
  body: `---
name: gello-plan
description: Break a gello epic into dependent child cards. Interview the human about the epic, draft a stepwise plan + dependency graph into epic.md, and only on approval create the wired child cards. Use when asked to plan or break down an epic.
---

# Plan a gello epic into cards

gello is a Markdown-native Kanban board: every card is one \`.md\` file under
\`.gello/\` with YAML frontmatter. An **epic** (\`epics/eNN-<slug>/\`) is a large
effort broken into dependent child cards. This skill turns an epic's goal into
that breakdown — **two phases, human-gated: plan → approve → create**. Nothing
is created before the human approves.

## Board format you're writing into

\`\`\`
epics/eNN-<slug>/
  epic.md            # id: eNN, title, status; ## Goal, ## Definition of done
  c001-<slug>.md     # child cards, flat within the epic
\`\`\`

Child-card frontmatter: \`id\` (per-board sequential — \`c\`+4 digits for tasks,
\`i\`+4 for issues; never reused, renumbered, or duplicated), \`title\`,
\`status: backlog\`, \`epic: eNN\`, \`depends: [<ids>]\`, \`created\`, \`updated\`.
Bodies use \`## What\`, \`## Acceptance criteria\` (\`- [ ]\`, each testable),
\`## Notes\`, \`## Log\`.

## Find the epic and the next free ids

\`\`\`bash
grep -rh "^id: " .gello/epics/*/epic.md                     # existing epics
sed -n '/^---$/,/^---$/p' .gello/epics/<eNN-slug>/epic.md    # the epic's goal
grep -rhoE "^id: [ci][0-9]+" .gello/inbox .gello/epics .gello/cards | sort -u  # taken ids
\`\`\`

## Phase 1 — interview + plan (write only epic.md)

1. Read \`epic.md\` — its Goal and Definition of done — and any related cards.
2. Interview the human, one topic at a time: scope boundaries, constraints,
   the smallest shippable slice, what is explicitly out.
3. Draft a \`## Plan (steps + dependencies)\` section into \`epic.md\` with a
   surgical edit (preserve untouched lines byte-for-byte, valid YAML): an
   ordered list of proposed child cards, each a one-line scope plus its
   dependencies (e.g. \`3. Card — … (← step 1, step 2)\`). Number steps so the
   dependency graph reads top-down (root steps first). **Create no card files.**

## Phase 2 — create the child cards (only on explicit approval)

4. Present the plan and ask for approval. Change nothing until the human
   approves or adjusts it — this is the single checkpoint.
5. On approval, create one card file per step in \`epics/eNN-<slug>/\`:
   - allocate fresh sequential ids (never reuse or renumber existing ones),
   - set \`epic: eNN\`, \`status: backlog\`, and \`depends:\` wired to the ids of
     the steps it follows,
   - write a \`## What\`, a drafted \`## Acceptance criteria\`, and a \`## Log\`
     line citing "created from the eNN epic breakdown".
6. Leave every card in \`backlog\`; the human moves roots to \`ready\` when it's
   time to work. **Never** set \`in-progress\`.

## Rules

- Two-phase always: nothing is created before the human approves the plan.
- Ids are per-board and unique; existing ids never change.
- Surgical frontmatter edits; only statuses from \`board.yaml\`.
`,
};

/** Every gello-managed skill the installer ships (c032/c029). */
export const ALL_SKILLS: SkillTemplate[] = [DISCUSS_SKILL, ONBOARD_SKILL, PLAN_SKILL];
