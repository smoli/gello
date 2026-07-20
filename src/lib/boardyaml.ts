// Surgical writer for board.yaml (c0060). board.yaml is plain YAML (not
// `---`-delimited frontmatter), so it needs its own top-level line editor that
// keeps the parse-only, never-dump discipline: unrelated keys, comments, and
// formatting survive byte-for-byte.

/** Quote a scalar only when YAML would misread it plain (mirrors cards.ts). */
function formatScalar(value: string): string {
  return /:(\s|$)|[#[\]{}"'\n&*|>%@`]|^[\s-]|\s$/.test(value) || value === ""
    ? JSON.stringify(value)
    : value;
}

/** Set (or append) a top-level `key: value` line. */
export function setBoardKey(raw: string, key: string, value: string): string {
  const line = `${key}: ${formatScalar(value)}`;
  const lineRe = new RegExp(`^${key}:.*$`, "m");
  if (lineRe.test(raw)) return raw.replace(lineRe, line);
  return `${raw.replace(/\s*$/, "\n")}${line}\n`;
}

/** Remove a top-level `key:` line, if present. */
export function removeBoardKey(raw: string, key: string): string {
  return raw.replace(new RegExp(`^${key}:.*\\n?`, "m"), "");
}

// --- tag_colors block (c0058) -----------------------------------------------
//
// Per-tag colour overrides are a nested mapping under `tag_colors:`. Edits are
// surgical on the block's child lines, so siblings and unrelated keys survive.

const TAG_COLORS_HEADER = /^tag_colors:\s*$/;

/** A line indented under a block header (a child entry), not blank. */
function isBlockChild(line: string): boolean {
  return /^\s+\S/.test(line);
}

/** The key of a `  key: value` child line, unquoting a quoted key. */
function childKey(line: string): string | null {
  const trimmed = line.replace(/^\s+/, "");
  if (trimmed.startsWith('"')) {
    const match = /^"(?:[^"\\]|\\.)*"/.exec(trimmed);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as string;
    } catch {
      return null;
    }
  }
  const colon = trimmed.indexOf(":");
  return colon === -1 ? null : trimmed.slice(0, colon);
}

/** Set (or replace) a tag's colour override in the `tag_colors:` block. */
export function setTagColor(raw: string, tag: string, colour: string): string {
  const childLine = `  ${formatScalar(tag)}: ${formatScalar(colour)}`;
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex((line) => TAG_COLORS_HEADER.test(line));
  if (headerIdx === -1) {
    const base = raw.replace(/\s*$/, "\n");
    return `${base}tag_colors:\n${childLine}\n`;
  }
  let i = headerIdx + 1;
  let replaceAt = -1;
  while (i < lines.length && isBlockChild(lines[i])) {
    if (childKey(lines[i]) === tag) replaceAt = i;
    i += 1;
  }
  if (replaceAt !== -1) lines[replaceAt] = childLine;
  else lines.splice(i, 0, childLine);
  return lines.join("\n");
}

/** Remove a tag's colour override; drop the block when it becomes empty. */
export function removeTagColor(raw: string, tag: string): string {
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex((line) => TAG_COLORS_HEADER.test(line));
  if (headerIdx === -1) return raw;
  const children: number[] = [];
  let i = headerIdx + 1;
  while (i < lines.length && isBlockChild(lines[i])) {
    children.push(i);
    i += 1;
  }
  const target = children.find((idx) => childKey(lines[idx]) === tag);
  if (target === undefined) return raw;
  const drop = children.length === 1 ? [headerIdx, target] : [target];
  return lines.filter((_, idx) => !drop.includes(idx)).join("\n");
}
