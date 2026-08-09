// The `## Review` verdict an AI review agent records on a card (c0166).
//
// The card is the only channel between the review agent and everything else, so
// the verdict is markdown on the card: a `## Review` section, one
// `### <stamp> — <pass|fail>` entry per round, newest last. Anything the format
// does not describe reads as no verdict, never as a pass — a malformed entry
// must not sign a card off (the same safe default as the AFK flag, c0162).
//
// The companion writes it (companion/review.ts holds the skill that tells the
// agent how, and the prompt it rides in) and the board reads it back — the
// sign-off column shows each card's verdict (c0170). The format sits here, in
// app code, so both sides parse it the same way.

export type ReviewVerdict = "pass" | "fail";

export interface ReviewEntry {
  verdict: ReviewVerdict;
  /** The entry's datetime, as written in the heading (empty if it carried none). */
  stamp: string;
  /** What was checked and why it passed or failed, as markdown. */
  notes: string;
}

/** One `## Review` entry in the documented shape. */
export function formatReviewEntry(entry: ReviewEntry): string {
  return `### ${entry.stamp} — ${entry.verdict}\n\n${entry.notes}\n`;
}

/** A level-2 heading line, e.g. `## Review` (but not `### …`). */
const H2_RE = /^##\s+(.*?)\s*$/;
/** An entry heading: `### <stamp> — <verdict>`, the verdict word last. */
const ENTRY_RE = /^###\s+(.*?)(?:\s*[—–-]\s*)?(pass|fail)\s*$/i;

/** Every verdict entry in the card body's `## Review` section, in order. */
export function parseReview(body: string): ReviewEntry[] {
  const entries: ReviewEntry[] = [];
  let inSection = false;
  let stamp = "";
  let verdict: ReviewVerdict | null = null;
  let notes: string[] = [];

  const flush = () => {
    if (verdict) entries.push({ verdict, stamp, notes: notes.join("\n").trim() });
    verdict = null;
    notes = [];
  };

  for (const line of body.split("\n")) {
    const heading = H2_RE.exec(line);
    if (heading) {
      flush();
      inSection = heading[1].toLowerCase() === "review";
      continue;
    }
    if (!inSection) continue;
    const entry = ENTRY_RE.exec(line);
    if (entry) {
      flush();
      stamp = entry[1].trim();
      verdict = entry[2].toLowerCase() as ReviewVerdict;
      continue;
    }
    if (verdict) notes.push(line);
  }
  flush();
  return entries;
}

/** The card's current verdict — the last review round, or `null` if none. */
export function latestReview(body: string): ReviewEntry | null {
  const entries = parseReview(body);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}
