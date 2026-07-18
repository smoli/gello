import { describe, expect, it } from "vitest";
import { rebaseCard } from "./conflict";
import { parseCard, DEFAULT_BOARD_CONFIG } from "./cards";

const RAW = `---
id: c001
title: First
status: ready
epic: e01
created: 2026-07-10
updated: 2026-07-10
---

## What

original body
`;

function card() {
  const parsed = parseCard("epics/e01-x/c001-first.md", RAW);
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.card;
}

describe("rebaseCard (c015)", () => {
  it("returns the original card when disk is unchanged", () => {
    const c = card();
    expect(rebaseCard(c, c.raw, DEFAULT_BOARD_CONFIG)).toBe(c);
  });

  it("returns the original card when the file is gone (null)", () => {
    const c = card();
    expect(rebaseCard(c, null, DEFAULT_BOARD_CONFIG)).toBe(c);
  });

  it("returns the disk card when the file changed externally and still parses", () => {
    const c = card();
    const externallyChanged = RAW.replace("original body", "agent rewrote this");
    const rebased = rebaseCard(c, externallyChanged, DEFAULT_BOARD_CONFIG);
    expect(rebased).not.toBe(c);
    expect(rebased.body).toContain("agent rewrote this");
    expect(rebased.raw).toBe(externallyChanged);
  });

  it("falls back to the original card when the disk content no longer parses", () => {
    const c = card();
    const broken = "not: [valid yaml\nno frontmatter close";
    expect(rebaseCard(c, broken, DEFAULT_BOARD_CONFIG)).toBe(c);
  });
});
