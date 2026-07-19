// c0101: the `gelloquestion` fenced-block format for card-based agent Q&A.
//
// An agent parks a question as a fenced code block tagged `gelloquestion` whose
// content is markdown — the question text plus answer slots: a checkbox list
// (`- [ ]`) for a choice, or no checkboxes for an open (free-text) question. The
// `awaiting: input` frontmatter marker flags that the turn is unanswered.
//
// When the human answers, the app un-fences the block in place (the resolved
// Q&A becomes plain markdown) and clears the marker; the companion resumes.

/** A parsed `gelloquestion` block. */
export interface GelloQuestion {
  /** The markdown between the fences (question + slots). */
  inner: string;
  /** The question text — `inner` with the checkbox option lines removed. */
  prompt: string;
  /** Checkbox option labels, in document order (empty for an open question). */
  options: string[];
  /** True when the question offers checkbox choices. */
  isChoice: boolean;
}

/** The human's answer to a parked question. */
export type GelloAnswer =
  | { kind: "choice"; selected: number[] }
  | { kind: "open"; text: string };

// The fence must sit at the start of a line; inner content is captured lazily.
const FENCE_RE = /^```gelloquestion[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/m;
const CHECKBOX_RE = /^(\s*[-*]\s*)\[[ xX]\](\s*)(.*)$/;

/** Parse the first `gelloquestion` block in a card body, or null if none. */
export function parseGelloQuestion(body: string): GelloQuestion | null {
  const match = FENCE_RE.exec(body);
  if (!match) return null;
  const inner = match[1];
  const lines = inner.split(/\r?\n/);
  const options = lines
    .map((line) => CHECKBOX_RE.exec(line)?.[3]?.trim())
    .filter((label): label is string => label !== undefined);
  const prompt = lines
    .filter((line) => !CHECKBOX_RE.test(line))
    .join("\n")
    .trim();
  return { inner, prompt, options, isChoice: options.length > 0 };
}

/** Remove the `gelloquestion` block from a body (for the in-detail render that
 *  shows the question in its own panel). Collapses the gap it leaves. */
export function stripGelloQuestion(body: string): string {
  if (!FENCE_RE.test(body)) return body;
  return body.replace(FENCE_RE, "").replace(/\n{3,}/g, "\n\n");
}

/** Apply the answer to the inner markdown (check chosen boxes, or append text). */
function answeredInner(inner: string, answer: GelloAnswer): string {
  if (answer.kind === "open") {
    const text = answer.text.trim();
    return text ? `${inner.replace(/\s*$/, "")}\n\n${text}` : inner;
  }
  const selected = new Set(answer.selected);
  let checkboxIndex = -1;
  return inner
    .split(/\r?\n/)
    .map((line) => {
      const match = CHECKBOX_RE.exec(line);
      if (!match) return line;
      checkboxIndex += 1;
      const mark = selected.has(checkboxIndex) ? "x" : " ";
      return `${match[1]}[${mark}]${match[2]}${match[3]}`;
    })
    .join("\n");
}

/**
 * Replace the `gelloquestion` fence in `body` with its un-fenced, answered
 * content (the resolved Q&A as plain markdown, in place). Returns null when the
 * body has no such block.
 */
export function unfenceWithAnswer(body: string, answer: GelloAnswer): string | null {
  const match = FENCE_RE.exec(body);
  if (!match) return null;
  const resolved = answeredInner(match[1], answer);
  return body.slice(0, match.index) + resolved + body.slice(match.index + match[0].length);
}
