// gello skill installer (c032). Generic "install a gello-managed skill into
// detected agent-skill locations" mechanism; the discuss skill is the first
// skill. Reused by c029 (legacy onboarding) later.

export const SKILL_VERSION = 1;

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

export const DISCUSS_SKILL: SkillTemplate = {
  folder: "gello-discuss",
  version: SKILL_VERSION,
  body: `---
name: gello-discuss
description: Interview the human about a gello board card flagged \`status: discuss\` and write the refined outcome back into the card. Use when asked to discuss a gello card, or when picking up work and only discuss-flagged cards remain.
---

# Discuss a gello card

gello is a Markdown-native Kanban board: every card is one \`.md\` file under
\`.gello/\` with YAML frontmatter (\`id\`, \`title\`, \`status\`, \`milestone\`,
\`priority\`, …). The \`discuss\` status means the human wants to think a card
through with you *before* it becomes implementable — usually a raw inbox idea.

## Find discuss cards

\`\`\`bash
grep -rl "^status: discuss" .gello/inbox .gello/milestones --include="[ci][0-9]*.md"
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
5. **Offer triage** — assign to a milestone / \`backlog\` / \`ready\`. Only the
   human decides the exit; perform any move only on explicit confirmation.

## Triage move (only on the human's say-so)

Moving a card between folders is a file move plus a status edit:
- inbox → milestone: move \`.gello/inbox/<card>.md\` to
  \`.gello/milestones/<m>/<card>.md\`, set \`milestone:\`, and rewrite relative
  asset links (\`](../assets/\` → \`](../../assets/\`).
- Set \`status\` and \`status-changed\` (local ISO datetime) on any status change.
- Never reuse or renumber existing card IDs.
`,
};
