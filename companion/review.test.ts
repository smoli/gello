import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/lib/board.ts";
import type { BoardModel } from "../src/lib/board.ts";
import { REVIEW_SKILL, buildReviewPrompt, parseReview } from "./review.ts";

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

/** The first fenced block in the skill text — where it shows the entry format. */
function fencedExample(text: string): string {
  const match = /```[a-z]*\n([\s\S]*?)```/.exec(text);
  return match ? match[1] : "";
}

// --- the skill --------------------------------------------------------------

describe("REVIEW_SKILL", () => {
  it("checks the acceptance criteria, tests, lint, typecheck and the diff", () => {
    expect(REVIEW_SKILL).toMatch(/acceptance criteri/i);
    expect(REVIEW_SKILL).toMatch(/test/i);
    expect(REVIEW_SKILL).toMatch(/lint/i);
    expect(REVIEW_SKILL).toMatch(/typecheck/i);
    expect(REVIEW_SKILL).toMatch(/diff/i);
  });

  it("requires a verdict recording what was checked, with reasons on fail", () => {
    expect(REVIEW_SKILL).toMatch(/verdict/i);
    expect(REVIEW_SKILL).toMatch(/pass/i);
    expect(REVIEW_SKILL).toMatch(/fail/i);
    expect(REVIEW_SKILL).toMatch(/reason/i);
    expect(REVIEW_SKILL).toContain("## Review");
  });

  it("moves the card to signoff on a pass", () => {
    expect(REVIEW_SKILL).toContain("signoff");
    expect(REVIEW_SKILL).toContain("set_status");
  });

  // c0168 routes a rejected card back to its implementer; the reviewer's job on
  // a fail ends with the notes, so it must not move the card on.
  it("leaves a failed card where it is, with notes for the implementer", () => {
    expect(REVIEW_SKILL).toMatch(/do not (move|set).*signoff/i);
    expect(REVIEW_SKILL).toMatch(/implementer/i);
  });

  // The reviewer verifies; fixing is the implementer's session (c0168). A
  // reviewer that edits code reviews its own work on the next round.
  it("forbids the reviewer changing the code or committing", () => {
    expect(REVIEW_SKILL).toMatch(/do not (edit|change|fix)/i);
    expect(REVIEW_SKILL).toMatch(/do not commit|never commit/i);
  });

  // The companion runs against any project, so the checks are named by role and
  // looked up in the repo's own docs — not hard-coded to this repo's commands.
  it("takes the check commands from the repo, not from a hard-coded list", () => {
    expect(REVIEW_SKILL).toContain("CLAUDE.md");
    expect(REVIEW_SKILL).not.toContain("pnpm test");
  });

  it("shows an entry format that the parser reads back", () => {
    const parsed = parseReview(fencedExample(REVIEW_SKILL));
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

  it("carries the whole skill, so the run needs nothing installed", () => {
    expect(buildReviewPrompt(card())).toContain(REVIEW_SKILL);
  });

  it("frames the run as a review, not as implementing the card", () => {
    const prompt = buildReviewPrompt(card());
    expect(prompt).toMatch(/review/i);
    expect(prompt).not.toMatch(/in-progress/);
  });
});
