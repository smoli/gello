import { describe, expect, it } from "vitest";
import { loadBoard } from "./board";
import {
  agentsMdContent,
  claudeMdContent,
  scaffoldFiles,
  CONVENTION_MARKER,
} from "./scaffold";

describe("scaffoldFiles", () => {
  const files = scaffoldFiles("/p/proj");

  it("creates the .gello layout (board.yaml, concept, inbox, assets, epics, cards)", () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("/p/proj/.gello/board.yaml");
    expect(paths).toContain("/p/proj/.gello/concept.md");
    expect(paths).toContain("/p/proj/.gello/inbox/.gitkeep");
    expect(paths).toContain("/p/proj/.gello/assets/.gitkeep");
    // c0081: a fresh board is born in the epic format — epics/ + standalone cards/
    expect(paths).toContain("/p/proj/.gello/epics/.gitkeep");
    expect(paths).toContain("/p/proj/.gello/cards/.gitkeep");
    expect(paths).not.toContain("/p/proj/.gello/milestones/.gitkeep");
  });

  it("ships the convention snippet with epic vocabulary, not milestone", () => {
    const snippet = claudeMdContent(null);
    expect(snippet).not.toMatch(/milestone/i);
    expect(snippet).toContain(".gello/epics");
  });

  it("produces a board.yaml that parses with the default columns", () => {
    const yaml = files.find((f) => f.path.endsWith("board.yaml"))!.content;
    const model = loadBoard([{ path: "board.yaml", content: yaml }]);
    expect(model.configError).toBeNull();
    expect(model.config.columns).toContain("backlog");
    expect(model.config.columns).toContain("done");
  });
});

describe("claudeMdContent", () => {
  it("creates a fresh CLAUDE.md from nothing", () => {
    const out = claudeMdContent(null);
    expect(out).toContain(CONVENTION_MARKER);
    expect(out.startsWith("#")).toBe(true);
  });

  it("appends to an existing CLAUDE.md without overwriting it", () => {
    const existing = "# My project\n\nSome notes.\n";
    const out = claudeMdContent(existing);
    expect(out.startsWith(existing)).toBe(true);
    expect(out).toContain(CONVENTION_MARKER);
  });

  it("is idempotent — never appends the snippet twice", () => {
    const once = claudeMdContent("# proj\n");
    expect(claudeMdContent(once)).toBe(once);
  });
});

describe("agentsMdContent", () => {
  it("appends the convention to an existing AGENTS.md, preserving it", () => {
    const existing = "# Agents\n\nHouse rules.\n";
    const out = agentsMdContent(existing);
    expect(out.startsWith(existing)).toBe(true);
    expect(out).toContain(CONVENTION_MARKER);
  });

  it("is idempotent — never appends the snippet twice", () => {
    const once = agentsMdContent("# Agents\n");
    expect(agentsMdContent(once)).toBe(once);
  });

  it("handles an empty AGENTS.md without leading blank lines", () => {
    const out = agentsMdContent("");
    expect(out.startsWith(CONVENTION_MARKER)).toBe(true);
  });
});
