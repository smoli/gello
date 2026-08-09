import { describe, expect, it } from "vitest";
import { formatReviewEntry, latestReview, parseReview } from "./review";

// The verdict format is defined by c0166 and read by the board (c0170). These
// tests moved here with the parser; companion/review.test.ts keeps the skill
// text and checks the format documented there still parses.

describe("parseReview", () => {
  const section = (entries: string) =>
    `## What\n\ntask\n\n## Review\n\n${entries}\n## Log\n\n- x\n`;

  it("finds no verdict on a card without a Review section", () => {
    expect(parseReview("## What\n\ntask\n")).toEqual([]);
    expect(latestReview("## What\n\ntask\n")).toBeNull();
  });

  it("reads the verdict, stamp and notes of an entry", () => {
    const body = section("### 2026-08-08T21:04:11 — pass\n\nChecked: criteria, tests, lint.\n");
    expect(parseReview(body)).toEqual([
      {
        verdict: "pass",
        stamp: "2026-08-08T21:04:11",
        notes: "Checked: criteria, tests, lint.",
      },
    ]);
  });

  it("keeps rounds in order and takes the last as the current verdict", () => {
    const body = section(
      "### 2026-08-08T21:04:11 — fail\n\ntests red\n\n### 2026-08-08T22:10:00 — pass\n\nall green\n",
    );
    expect(parseReview(body).map((e) => e.verdict)).toEqual(["fail", "pass"]);
    expect(latestReview(body)?.notes).toBe("all green");
  });

  it("does not swallow the section that follows", () => {
    const body = section("### 2026-08-08T21:04:11 — fail\n\ntests red\n");
    expect(latestReview(body)?.notes).toBe("tests red");
  });

  it("accepts a plain hyphen and any casing of the verdict", () => {
    const body = section("### 2026-08-08T21:04:11 - FAIL\n\nnope\n");
    expect(latestReview(body)?.verdict).toBe("fail");
  });

  // Anything the format does not describe must not read as a pass — the same
  // safe default as the AFK flag (c0162).
  it("ignores an entry whose heading carries no recognised verdict", () => {
    expect(parseReview(section("### 2026-08-08T21:04:11 — looks good\n\nlgtm\n"))).toEqual([]);
  });

  it("ignores review-shaped headings outside the Review section", () => {
    const body = "## Notes\n\n### 2026-08-08T21:04:11 — pass\n\nnot a verdict\n";
    expect(parseReview(body)).toEqual([]);
  });
});

describe("formatReviewEntry", () => {
  it("round-trips through the parser", () => {
    const entry = {
      verdict: "fail" as const,
      stamp: "2026-08-08T21:04:11",
      notes: "- criterion 3 unmet",
    };
    expect(parseReview(`## Review\n\n${formatReviewEntry(entry)}`)).toEqual([entry]);
  });
});
