// Body-text utilities for task list items ("- [ ]" / "- [x]").
//
// Indexing matches GFM rendering document order. Toggling is a surgical
// single-line edit — same philosophy as frontmatter writes in cards.ts.

/** List marker (bullet or ordered) followed by a checkbox. */
const CHECKBOX_RE = /^(\s*(?:[-*+]|\d+\.) +)\[( |x|X)\]/;

function taskLineNumbers(body: string): number[] {
  const lines = body.split("\n");
  const numbers: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const indent = lines[i].match(/^(\s*)/)![1];
    // a tab or ≥4-space indent is an indented code block, not a task
    if (indent.includes("\t") || indent.length >= 4) continue;
    if (CHECKBOX_RE.test(lines[i])) numbers.push(i);
  }
  return numbers;
}

/** Number of task list items in the body, in document order. */
export function countTaskItems(body: string): number {
  return taskLineNumbers(body).length;
}

/**
 * Flip the checkbox of the `index`-th task item (document order).
 * Only that line changes; everything else is preserved byte-for-byte.
 */
export function toggleTaskItem(body: string, index: number): string {
  const numbers = taskLineNumbers(body);
  if (index < 0 || index >= numbers.length) {
    throw new Error(`task index ${index} out of range (${numbers.length} tasks)`);
  }
  const lines = body.split("\n");
  const lineNo = numbers[index];
  lines[lineNo] = lines[lineNo].replace(
    CHECKBOX_RE,
    (_, prefix: string, state: string) =>
      `${prefix}[${state === " " ? "x" : " "}]`,
  );
  return lines.join("\n");
}
