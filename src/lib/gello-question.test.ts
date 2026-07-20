import { describe, expect, it } from "vitest";
import {
  insertGelloQuestion,
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
    const out = unfenceWithAnswer(CHOICE, { selected: [1], text: "" })!;
    expect(out).not.toContain("```gelloquestion");
    expect(out).not.toContain("```");
    expect(out).toContain("- [x] SQLite");
    expect(out).toContain("- [ ] Postgres");
    // surrounding body is preserved
    expect(out).toContain("## What");
    expect(out).toContain("more body");
  });

  it("appends the typed answer for an open question and un-fences", () => {
    const out = unfenceWithAnswer(OPEN, { selected: [], text: "30 seconds" })!;
    expect(out).not.toContain("```");
    expect(out).toContain("What should the timeout be?");
    expect(out).toContain("30 seconds");
    expect(out.startsWith("intro")).toBe(true);
  });

  it("returns null when there is nothing to un-fence", () => {
    expect(unfenceWithAnswer("no fence here\n", { selected: [], text: "x" })).toBeNull();
  });

  // c0103: free text is available on every question, so an answer can carry a
  // choice, a note, or both — the note is where the human says the thing the
  // agent did not offer.
  it("keeps the checked boxes and appends the note when both are given", () => {
    const out = unfenceWithAnswer(CHOICE, {
      selected: [1],
      text: "but only if we can drop the ORM",
    })!;
    expect(out).toContain("- [x] SQLite");
    expect(out).toContain("- [ ] Postgres");
    expect(out).toContain("but only if we can drop the ORM");
    // the note goes after the options, not between them
    expect(out.indexOf("- [x] SQLite")).toBeLessThan(
      out.indexOf("but only if we can drop the ORM"),
    );
  });

  it("takes a note alone on a choice question, leaving every box unchecked", () => {
    const out = unfenceWithAnswer(CHOICE, { selected: [], text: "neither — use DuckDB" })!;
    expect(out).not.toContain("- [x]");
    expect(out).toContain("neither — use DuckDB");
  });

  it("ignores whitespace-only text", () => {
    const out = unfenceWithAnswer(CHOICE, { selected: [0], text: "   \n  " })!;
    expect(out.trimEnd().endsWith("more body")).toBe(true);
  });
});

describe("insertGelloQuestion (c0102)", () => {
  it("puts the question at the top of the body, fenced, keeping the rest", () => {
    const body = "\n## What\n\ndo a thing\n";
    const out = insertGelloQuestion(body, "Which database?\n\n- [ ] Postgres\n- [ ] SQLite")!;

    expect(out).toContain("```gelloquestion");
    expect(out.indexOf("```gelloquestion")).toBeLessThan(out.indexOf("## What"));
    expect(out).toContain("do a thing");

    // it round-trips through the parser it is the source of
    const q = parseGelloQuestion(out)!;
    expect(q.prompt).toBe("Which database?");
    expect(q.options).toEqual(["Postgres", "SQLite"]);
  });

  it("refuses a second question while one is still open", () => {
    const withOpen = insertGelloQuestion("\nbody\n", "First?")!;
    expect(insertGelloQuestion(withOpen, "Second?")).toBeNull();
  });

  it("un-fencing its own output yields plain markdown again", () => {
    const out = insertGelloQuestion("\nbody\n", "Pick\n\n- [ ] a\n- [ ] b")!;
    const answered = unfenceWithAnswer(out, { selected: [0], text: "" })!;
    expect(answered).not.toContain("```");
    expect(answered).toContain("- [x] a");
    expect(answered).toContain("body");
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
