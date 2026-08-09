import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/lib/board.ts";
import type { BoardModel } from "../src/lib/board.ts";
import { REVIEW_SKILL, skillInstructions } from "../src/lib/skills.ts";
import { buildReviewPrompt, parseReview } from "./review.ts";

/** The skill as a review run gets it: the installed SKILL.md without its
 *  frontmatter (i0174 moved the text into the installer's skill). */
const skill = skillInstructions(REVIEW_SKILL);

// --- fixtures ---------------------------------------------------------------

function board(): BoardModel {
  return loadBoard([
    { path: "board.yaml", content: "columns: [ready, in-progress, review, signoff, done]\n" },
    {
      path: "cards/c001-x.md",
      content: "---\nid: c001\ntitle: Card c001\nstatus: review\n---\n\n## What\n\ntask\n",
    },
  ]);
}

const card = () => board().cards.find((c) => c.id === "c001")!;

/** The skill's ```markdown block — where it shows the entry format. Named by
 *  language, since the skill also carries a bash block for finding the card. */
function fencedExample(text: string): string {
  const match = /```markdown\n([\s\S]*?)```/.exec(text);
  return match ? match[1] : "";
}

// --- the skill --------------------------------------------------------------

describe("the review skill", () => {
  it("checks the acceptance criteria, tests, lint, typecheck and the diff", () => {
    expect(skill).toMatch(/acceptance criteri/i);
    expect(skill).toMatch(/test/i);
    expect(skill).toMatch(/lint/i);
    expect(skill).toMatch(/typecheck/i);
    expect(skill).toMatch(/diff/i);
  });

  it("requires a verdict recording what was checked, with reasons on fail", () => {
    expect(skill).toMatch(/verdict/i);
    expect(skill).toMatch(/pass/i);
    expect(skill).toMatch(/fail/i);
    expect(skill).toMatch(/reason/i);
    expect(skill).toContain("## Review");
  });

  it("moves the card to signoff on a pass", () => {
    expect(skill).toContain("signoff");
    expect(skill).toContain("set_status");
  });

  // c0168 routes a rejected card back to its implementer; the reviewer's job on
  // a fail ends with the notes, so it must not move the card on.
  it("leaves a failed card where it is, with notes for the implementer", () => {
    expect(skill).toMatch(/do not (move|set).*signoff/i);
    expect(skill).toMatch(/implementer/i);
  });

  // The reviewer verifies; fixing is the implementer's session (c0168). A
  // reviewer that edits code reviews its own work on the next round.
  it("forbids the reviewer changing the code or committing", () => {
    expect(skill).toMatch(/do not (edit|change|fix)/i);
    expect(skill).toMatch(/do not commit|never commit/i);
  });

  // The companion runs against any project, so the checks are named by role and
  // looked up in the repo's own docs — not hard-coded to this repo's commands.
  it("takes the check commands from the repo, not from a hard-coded list", () => {
    expect(skill).toContain("CLAUDE.md");
    expect(skill).not.toContain("pnpm test");
  });

  it("shows an entry format that the parser reads back", () => {
    const parsed = parseReview(fencedExample(skill));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].verdict).toBe("fail");
  });
});

// --- the prompt -------------------------------------------------------------

describe("buildReviewPrompt", () => {
  it("names the card and its file", () => {
    const prompt = buildReviewPrompt(card());
    expect(prompt).toContain("c001");
    expect(prompt).toContain("cards/c001-x.md");
  });

  // i0174: the skill's home is the installer, but the prompt still carries the
  // text — a review run must not depend on the human having installed it.
  it("carries the whole skill, so the run needs nothing installed", () => {
    expect(buildReviewPrompt(card())).toContain(skill);
  });

  it("frames the run as a review, not as implementing the card", () => {
    const prompt = buildReviewPrompt(card());
    expect(prompt).toMatch(/review/i);
    expect(prompt).not.toMatch(/in-progress/);
  });
});
