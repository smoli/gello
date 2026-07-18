// c0083: build the auto-commit message from the net board diff (HEAD vs
// worktree). Pure — the caller supplies each changed card parsed at HEAD
// (`before`) and in the worktree (`after`). The message is a subject line plus
// one block per changed card listing only the kinds that actually changed:
// content update, status/epic/tag transitions (a catch-all "updated" covers a
// changed card with none of those, e.g. a pure reorder, so no change is
// silently dropped).

import { splitLogSection } from "./markdown";
import type { Card } from "./cards";

export interface BoardChange {
  id: string;
  /** Fallback title when a side is missing (e.g. a deletion). */
  title: string;
  /** Parsed card at HEAD, or null when newly added. */
  before: Card | null;
  /** Parsed card in the worktree, or null when deleted. */
  after: Card | null;
}

/** `tags +ui -perf` when the tag set changed, else null. */
function tagsLine(before: string[], after: string[]): string | null {
  const added = after.filter((tag) => !before.includes(tag));
  const removed = before.filter((tag) => !after.includes(tag));
  if (added.length === 0 && removed.length === 0) return null;
  const parts = [...added.map((tag) => `+${tag}`), ...removed.map((tag) => `-${tag}`)];
  return `tags ${parts.join(" ")}`;
}

/** The change lines for one card (without the leading "- "). */
function changeLines(before: Card | null, after: Card | null): string[] {
  if (before === null && after === null) return [];
  if (before === null) return ["new card"];
  if (after === null) return ["deleted"];

  const lines: string[] = [];
  // content = the human-editable body; the machine-managed Log section churns
  // on every status write, so it must not count as a content change (c041)
  const beforeBody = splitLogSection(before.body).editable.trim();
  const afterBody = splitLogSection(after.body).editable.trim();
  if (beforeBody !== afterBody) lines.push("content update");
  if (before.status !== after.status) {
    lines.push(`status ${before.status} → ${after.status}`);
  }
  if ((before.epic ?? "none") !== (after.epic ?? "none")) {
    lines.push(`epic ${before.epic ?? "none"} → ${after.epic ?? "none"}`);
  }
  const tags = tagsLine(before.tags, after.tags);
  if (tags) lines.push(tags);
  // a genuinely-changed card with no tracked transition (e.g. a pure reorder)
  // still gets a block, so the commit covers it and the dirty state clears —
  // but two identical cards (equal raw) produce nothing.
  if (lines.length === 0 && before.raw !== after.raw) lines.push("updated");
  return lines;
}

/**
 * The commit message for a batch of changed cards, or null when nothing has a
 * net change (so the caller makes no empty commit).
 */
export function buildCommitMessage(changes: BoardChange[]): string | null {
  const blocks: string[] = [];
  for (const change of changes) {
    const lines = changeLines(change.before, change.after);
    if (lines.length === 0) continue;
    const title = change.after?.title ?? change.before?.title ?? change.title;
    blocks.push([`${change.id}: ${title}`, ...lines.map((line) => `- ${line}`)].join("\n"));
  }
  if (blocks.length === 0) return null;
  const noun = blocks.length === 1 ? "card" : "cards";
  return `board: ${blocks.length} ${noun} updated\n\n${blocks.join("\n\n")}\n`;
}
