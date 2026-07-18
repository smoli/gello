// c0079: convert a pre-epic milestone-format board to the epic format.
//
// Pure planning — no filesystem access. Callers detect a legacy board with
// isLegacyBoard, gate rendering, then apply planMigration's writes-then-deletes
// on disk (new tree written before the old is removed — never half-deleted).
//
// All edits are surgical line rewrites on the frontmatter: only the `id:` /
// `milestone:` lines change, so comments, unknown fields and body prose survive
// byte-for-byte (CLAUDE.md: never dump YAML). The mNN → eNN remap preserves the
// number; only the namespace prefix flips. Folder depth is unchanged
// (milestones/mNN/ and epics/eNN/ are both two deep), so relative asset links —
// keyed by card id, which never changes — need no rewrite.

import type { BoardFile } from "./board";

export interface MigrationPlan {
  /** New files to write first (epic-format tree). */
  writes: BoardFile[];
  /** Old files to remove only after every write has landed. */
  deletes: string[];
}

/** Lines inside the first `---` … `---` frontmatter block (empty if none). */
function frontmatterLines(content: string): string[] {
  const lines = content.split("\n");
  if (lines[0] !== "---") return [];
  const end = lines.indexOf("---", 1);
  return end === -1 ? [] : lines.slice(1, end);
}

/** Rewrite only the frontmatter lines, leaving the body untouched. */
function editFrontmatter(content: string, edit: (line: string) => string): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") return content;
  const end = lines.indexOf("---", 1);
  if (end === -1) return content;
  for (let i = 1; i < end; i++) lines[i] = edit(lines[i]);
  return lines.join("\n");
}

/**
 * Detect a board that needs migrating. Signals: the pre-epic milestone format
 * (any `milestones/` path or a `milestone:` frontmatter key), or the pre-status
 * inbox format (c0091 — an `inbox/` folder; inbox is a status now, not a home).
 */
export function isLegacyBoard(files: BoardFile[]): boolean {
  return files.some((file) => {
    const top = file.path.split("/")[0];
    if (top === "milestones" || top === "inbox") return true;
    return frontmatterLines(file.content).some((line) => /^milestone:\s/.test(line));
  });
}

/** milestones/mNN-name/<file> → epics/eNN-name/<file>; milestone.md → epic.md. */
function migratePath(path: string): string {
  const segments = path.split("/");
  segments[0] = "epics";
  if (segments.length > 1) segments[1] = segments[1].replace(/^m(\d+)/, "e$1");
  if (segments[segments.length - 1] === "milestone.md") {
    segments[segments.length - 1] = "epic.md";
  }
  return segments.join("/");
}

/** epic.md/milestone.md: `id: mNN` → `id: eNN`. */
function migrateEpicContent(content: string): string {
  return editFrontmatter(content, (line) => {
    const match = line.match(/^(\s*id:\s*)m(\d+)(.*)$/);
    return match ? `${match[1]}e${match[2]}${match[3]}` : line;
  });
}

/**
 * card: `milestone: mNN` → `epic: eNN` (rename the key, remap the value). Also
 * handles a card written mid-transition with the new `epic:` key but a legacy
 * `mNN` value (`epic: mNN` → `epic: eNN`).
 */
function migrateCardContent(content: string): string {
  return editFrontmatter(content, (line) => {
    const match = line.match(/^(\s*)(?:milestone|epic):(\s*)m(\d+)(.*)$/);
    return match ? `${match[1]}epic:${match[2]}e${match[3]}${match[4]}` : line;
  });
}

/** c0091: an inbox/ card moves to cards/ with `status: inbox`. A card already
 *  carrying a non-backlog status (an old c030 flagged card) keeps it. */
function migrateInboxCardContent(content: string): string {
  return editFrontmatter(content, (line) =>
    /^status:\s*backlog\s*$/.test(line) ? "status: inbox" : line,
  );
}

/** c0091: prepend `inbox` to board.yaml's `columns:` list, if absent. */
export function addInboxColumn(boardYaml: string): string {
  return boardYaml.replace(/^(columns:\s*\[)([^\]]*)(\])/m, (full, open, cols, close) => {
    const items = cols.split(",").map((s: string) => s.trim()).filter(Boolean);
    return items.includes("inbox") ? full : `${open}inbox, ${cols}${close}`;
  });
}

/**
 * Build the migration plan for a legacy board:
 * - `milestones/` → `epics/` with folder + id remap (c0079);
 * - `inbox/*.md` → `cards/` with `status: inbox` (c0091);
 * - `board.yaml` gains `inbox` as the first column (c0091).
 * Nothing else is touched. Writes come first, deletes after — apply in that
 * order so an interruption leaves the old tree intact, never half-deleted.
 */
export function planMigration(files: BoardFile[]): MigrationPlan {
  const writes: BoardFile[] = [];
  const deletes: string[] = [];
  for (const file of files) {
    const segments = file.path.split("/");
    const top = segments[0];

    if (top === "milestones") {
      const isEpicDoc =
        segments[segments.length - 1] === "milestone.md" ||
        segments[segments.length - 1] === "epic.md";
      const content = !file.path.endsWith(".md")
        ? file.content
        : isEpicDoc
          ? migrateEpicContent(file.content)
          : migrateCardContent(file.content);
      writes.push({ path: migratePath(file.path), content });
      deletes.push(file.path);
    } else if (top === "inbox" && segments.length === 2) {
      // c0091: inbox/<file> → cards/<file>; same depth, so asset links are fine
      const content = file.path.endsWith(".md")
        ? migrateInboxCardContent(file.content)
        : file.content;
      writes.push({ path: `cards/${segments[1]}`, content });
      deletes.push(file.path);
    } else if (file.path === "board.yaml") {
      // c0091: ensure `inbox` leads the columns list
      const migrated = addInboxColumn(file.content);
      if (migrated !== file.content) writes.push({ path: "board.yaml", content: migrated });
    }
  }
  return { writes, deletes };
}
