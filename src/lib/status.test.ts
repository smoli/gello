import { describe, expect, it } from "vitest";
import { loadBoard, type BoardFile } from "./board";
import { cardCounts, projectFolder } from "./status";

function file(path: string, content: string): BoardFile {
  return { path, content };
}
function card(id: string, status: string): string {
  return `---\nid: ${id}\ntitle: ${id}\nstatus: ${status}\n---\nx\n`;
}

describe("projectFolder", () => {
  it("returns the basename and full path of the folder containing .gello", () => {
    expect(projectFolder("/Users/x/proj/.gello")).toEqual({
      name: "proj",
      path: "/Users/x/proj",
    });
  });

  it("handles a trailing slash", () => {
    expect(projectFolder("/a/b/gello-app/.gello/")).toEqual({
      name: "gello-app",
      path: "/a/b/gello-app",
    });
  });
});

describe("cardCounts", () => {
  it("tallies cards per configured column across inbox and milestones", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, ready, done]\n"),
      file("inbox/c001-a.md", card("c001", "backlog")),
      file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: A\n---\ng\n"),
      file("milestones/m01-a/c002-b.md", card("c002", "ready")),
      file("milestones/m01-a/c003-c.md", card("c003", "ready")),
      file("milestones/m01-a/c004-d.md", card("c004", "done")),
    ]);

    expect(cardCounts(model)).toEqual([
      { column: "backlog", count: 1 },
      { column: "ready", count: 2 },
      { column: "done", count: 1 },
    ]);
  });

  it("reports zero for empty columns and ignores invalid cards", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog, done]\n"),
      file("inbox/c001-a.md", card("c001", "backlog")),
      file("inbox/c002-bad.md", "---\nid: [broken\n---\nx\n"),
    ]);

    expect(cardCounts(model)).toEqual([
      { column: "backlog", count: 1 },
      { column: "done", count: 0 },
    ]);
  });
});
