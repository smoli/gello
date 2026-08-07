//! c0151: the card's `## References` section — reference documents copied into
//! `assets/<card-id>/` and listed on the card as relative Markdown links. Pure
//! text edits on the body; the copying is board-io, the rendering CardDetail.

import { removeSection, replaceSection, splitLogSection } from "./markdown";

/** One entry of the References section: the original filename and its link. */
export interface Reference {
  label: string;
  /** Card-relative path, e.g. `../../assets/c0151/spec.pdf`. */
  target: string;
}

const HEADING = "References";

/** A `- [label](target)` list item, and nothing else in the section. */
const ENTRY_RE = /^\s*-\s+\[([^\]]*)\]\((\S+)\)\s*$/;

/** How the detail should present a reference: inline, or handed to the OS. */
export type ReferenceKind = "markdown" | "text" | "external";

const MARKDOWN_EXT = new Set(["md", "markdown"]);
const TEXT_EXT = new Set(["txt", "text", "log", "csv", "json", "yaml", "yml"]);

export function referenceKind(target: string): ReferenceKind {
  const name = target.split("/").pop() ?? target;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "external";
  const ext = name.slice(dot + 1).toLowerCase();
  if (MARKDOWN_EXT.has(ext)) return "markdown";
  if (TEXT_EXT.has(ext)) return "text";
  return "external";
}

/** The section's entries in document order; empty when the card has none. */
export function parseReferences(body: string): Reference[] {
  const { editable } = splitLogSection(body);
  const heading = /^##[ \t]+References[ \t]*$/mi.exec(editable);
  if (!heading) return [];
  const contentAt = heading.index + heading[0].length;
  const next = /^## /m.exec(editable.slice(contentAt));
  const content = editable.slice(
    contentAt,
    next ? contentAt + next.index : editable.length,
  );
  const references: Reference[] = [];
  for (const line of content.split("\n")) {
    const match = ENTRY_RE.exec(line);
    if (match) references.push({ label: match[1], target: match[2] });
  }
  return references;
}

/**
 * Write the given entries back, creating the section when there is one to
 * write and dropping it when the list runs empty. The section is placed in the
 * editable part, so the machine-managed `## Log` stays last.
 */
function writeReferences(body: string, references: Reference[]): string {
  const { editable, log } = splitLogSection(body);
  const next =
    references.length === 0
      ? removeSection(editable, HEADING)
      : replaceSection(
          editable,
          HEADING,
          references.map((ref) => `- [${ref.label}](${ref.target})`).join("\n"),
        );
  if (log === "") return next;
  return `${next.replace(/\s*$/, "\n")}\n${log}`;
}

/** Append one reference, creating the section if the card has none. */
export function addReference(body: string, reference: Reference): string {
  return writeReferences(body, [...parseReferences(body), reference]);
}

/**
 * Drop the entry pointing at `target`. The asset file itself stays — the same
 * policy as images, where assets are cleaned up when the card is deleted.
 */
export function removeReference(body: string, target: string): string {
  const references = parseReferences(body);
  const kept = references.filter((ref) => ref.target !== target);
  if (kept.length === references.length) return body;
  return writeReferences(body, kept);
}

/** The body without its References section — the detail renders it as a panel. */
export function stripReferences(body: string): string {
  const { editable, log } = splitLogSection(body);
  const next = removeSection(editable, HEADING);
  if (next === editable) return body;
  if (log === "") return next;
  return `${next.replace(/\s*$/, "\n")}\n${log}`;
}
