import { describe, expect, it } from "vitest";
import {
  parseGelloQuestion,
  stripGelloQuestion,
  unfenceWithAnswer,
} from "./gello-question";

const CHOICE = `## What

do a thing

\`\`\`gelloquestion
Which database?

- [ ] Postgres
- [ ] SQLite
\`\`\`

more body
`;

const OPEN = `intro

\`\`\`gelloquestion
What should the timeout be?
\`\`\`
`;

describe("parseGelloQuestion (c0101)", () => {
  it("parses a choice question with its options and prompt", () => {
    const q = parseGelloQuestion(CHOICE)!;
    expect(q).not.toBeNull();
    expect(q.isChoice).toBe(true);
    expect(q.options).toEqual(["Postgres", "SQLite"]);
    expect(q.prompt).toBe("Which database?"); // option lines removed
    expect(q.inner).toContain("Which database?");
  });

  it("parses an open question (no checkboxes)", () => {
    const q = parseGelloQuestion(OPEN)!;
    expect(q.isChoice).toBe(false);
    expect(q.options).toEqual([]);
    expect(q.inner.trim()).toBe("What should the timeout be?");
  });

  it("returns null when there is no gelloquestion block", () => {
    expect(parseGelloQuestion("just body, no fence\n")).toBeNull();
    // a plain code fence is not a gelloquestion
    expect(parseGelloQuestion("```ts\nconst x = 1;\n```\n")).toBeNull();
  });
});

describe("unfenceWithAnswer (c0101)", () => {
  it("checks the chosen box and removes the fence, leaving markdown in place", () => {
    const out = unfenceWithAnswer(CHOICE, { kind: "choice", selected: [1] })!;
    expect(out).not.toContain("```gelloquestion");
    expect(out).not.toContain("```");
    expect(out).toContain("- [x] SQLite");
    expect(out).toContain("- [ ] Postgres");
    // surrounding body is preserved
    expect(out).toContain("## What");
    expect(out).toContain("more body");
  });

  it("appends the typed answer for an open question and un-fences", () => {
    const out = unfenceWithAnswer(OPEN, { kind: "open", text: "30 seconds" })!;
    expect(out).not.toContain("```");
    expect(out).toContain("What should the timeout be?");
    expect(out).toContain("30 seconds");
    expect(out.startsWith("intro")).toBe(true);
  });

  it("returns null when there is nothing to un-fence", () => {
    expect(unfenceWithAnswer("no fence here\n", { kind: "open", text: "x" })).toBeNull();
  });
});

describe("stripGelloQuestion (c0101)", () => {
  it("removes the fence for the in-detail render, keeping the rest", () => {
    const out = stripGelloQuestion(CHOICE);
    expect(out).not.toContain("```gelloquestion");
    expect(out).not.toContain("Which database?");
    expect(out).toContain("## What");
    expect(out).toContain("more body");
  });

  it("returns the body unchanged when there is no block", () => {
    expect(stripGelloQuestion("plain body\n")).toBe("plain body\n");
  });
});
