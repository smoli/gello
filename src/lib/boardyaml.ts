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
