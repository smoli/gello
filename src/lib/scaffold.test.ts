import { describe, expect, it } from "vitest";
import { loadBoard } from "./board";
import { claudeMdContent, scaffoldFiles, CONVENTION_MARKER } from "./scaffold";

describe("scaffoldFiles", () => {
  const files = scaffoldFiles("/p/proj");

  it("creates the .gello layout (board.yaml, concept, inbox, assets, milestones)", () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("/p/proj/.gello/board.yaml");
    expect(paths).toContain("/p/proj/.gello/concept.md");
    expect(paths).toContain("/p/proj/.gello/inbox/.gitkeep");
    expect(paths).toContain("/p/proj/.gello/assets/.gitkeep");
    expect(paths).toContain("/p/proj/.gello/milestones/.gitkeep");
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
