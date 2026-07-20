// Body-text utilities for task list items ("- [ ]" / "- [x]").
//
// Counting matches GFM rendering document order.

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

const LOG_HEADING_RE = /^## Log[ \t]*$/m;

/**
 * Append one entry to the card's `## Log` section (c042), creating the
 * section at the end of the body if it doesn't exist. Only the Log section
 * changes; everything else is preserved byte-for-byte.
 */
export function appendLogLine(body: string, entry: string): string {
  const heading = LOG_HEADING_RE.exec(body);
  if (!heading) {
    const base = body === "" ? "" : body.replace(/\s*$/, "\n");
    return `${base}\n## Log\n\n- ${entry}\n`;
  }
  // the section ends at the next heading, or at EOF
  const afterHeading = heading.index + heading[0].length;
  const nextHeading = /^## /m.exec(body.slice(afterHeading));
  const insertAt = nextHeading ? afterHeading + nextHeading.index : body.length;
  const before = body.slice(0, insertAt).replace(/\s*$/, "\n");
  const after = body.slice(insertAt);
  return `${before}- ${entry}\n${after ? `\n${after}` : ""}`;
}

/**
 * Split a body into the human-editable part and the machine-managed Log
 * section (c041). The Log runs from its heading to the end of the body —
 * by convention it is the last section.
 */
export function splitLogSection(body: string): { editable: string; log: string } {
  const heading = LOG_HEADING_RE.exec(body);
  if (!heading) return { editable: body, log: "" };
  return { editable: body.slice(0, heading.index), log: body.slice(heading.index) };
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrite relative asset-link targets when a card file changes folder depth
 * (triage: inbox/ → milestones/<m>/). Only markdown link/image targets that
 * start with `fromPrefix` are touched; absolute paths, web URLs, and plain
 * text mentions stay as they are.
 */
export function retargetAssetLinks(
  raw: string,
  fromPrefix: string,
  toPrefix: string,
): string {
  const re = new RegExp(`\\]\\(${escapeRegExp(fromPrefix)}`, "g");
  return raw.replace(re, `](${toPrefix}`);
}
