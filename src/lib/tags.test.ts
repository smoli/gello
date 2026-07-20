import { describe, expect, it } from "vitest";
import { loadBoard, type BoardFile } from "./board";
import {
  autoTagColor,
  collectTags,
  planTagRename,
  renameTagInList,
  tagColor,
  TAG_PALETTE,
} from "./tags";

function file(path: string, content: string): BoardFile {
  return { path, content };
}

function card(id: string, status: string, tags: string[]): string {
  const tagLine = tags.length ? `tags: [${tags.join(", ")}]\n` : "";
  return `---\nid: ${id}\ntitle: Card ${id}\nstatus: ${status}\n${tagLine}---\nbody\n`;
}

const MODEL = loadBoard([
  file("board.yaml", "columns: [inbox, backlog, ready, done]\n"),
  file("cards/c001-a.md", card("c001", "backlog", ["ui", "agent-dx"])),
  file("cards/c002-b.md", card("c002", "ready", ["ui"])),
  file("epics/e01-x/epic.md", "---\nid: e01\ntitle: X\n---\ngoal\n"),
  file("epics/e01-x/c003-c.md", card("c003", "done", ["foundation", "ui"])),
  file("cards/c004-d.md", card("c004", "inbox", [])),
]);

describe("collectTags", () => {
  it("lists every tag in use with a card count, sorted by name", () => {
    expect(collectTags(MODEL)).toEqual([
      { tag: "agent-dx", count: 1 },
      { tag: "foundation", count: 1 },
      { tag: "ui", count: 3 },
    ]);
  });

  it("returns [] when no card carries a tag", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [backlog]\n"),
      file("cards/c001-a.md", card("c001", "backlog", [])),
    ]);
    expect(collectTags(model)).toEqual([]);
  });
});

describe("autoTagColor", () => {
  it("is deterministic and drawn from the palette", () => {
    expect(autoTagColor("ui")).toBe(autoTagColor("ui"));
    expect(TAG_PALETTE).toContain(autoTagColor("ui"));
  });

  it("gives different names a chance at different colours", () => {
    const colours = new Set(
      ["ui", "foundation", "agent-dx", "docs", "perf"].map(autoTagColor),
    );
    expect(colours.size).toBeGreaterThan(1);
  });
});

describe("tagColor", () => {
  it("uses the override when present", () => {
    expect(tagColor("ui", { ui: "#123456" })).toBe("#123456");
  });

  it("falls back to the auto colour when there is no override", () => {
    expect(tagColor("ui", {})).toBe(autoTagColor("ui"));
    expect(tagColor("ui", { other: "#000000" })).toBe(autoTagColor("ui"));
  });
});

describe("renameTagInList", () => {
  it("replaces the tag, preserving order", () => {
    expect(renameTagInList(["a", "b", "c"], "b", "x")).toEqual(["a", "x", "c"]);
  });

  it("dedups when the target already exists (merge)", () => {
    expect(renameTagInList(["a", "b"], "a", "b")).toEqual(["b"]);
    expect(renameTagInList(["b", "a"], "a", "b")).toEqual(["b"]);
  });

  it("leaves a list without the tag untouched", () => {
    expect(renameTagInList(["a", "b"], "z", "x")).toEqual(["a", "b"]);
  });
});

describe("planTagRename", () => {
  it("returns only the cards carrying the old tag, with their new tag lists", () => {
    const plan = planTagRename(MODEL, "ui", "interface");
    expect(plan.map((p) => [p.card.id, p.tags])).toEqual([
      ["c001", ["interface", "agent-dx"]],
      ["c002", ["interface"]],
      ["c003", ["foundation", "interface"]],
    ]);
  });

  it("dedups on merge into an existing tag", () => {
    const plan = planTagRename(MODEL, "agent-dx", "ui");
    expect(plan.map((p) => [p.card.id, p.tags])).toEqual([["c001", ["ui"]]]);
  });

  it("is empty when no card carries the tag", () => {
    expect(planTagRename(MODEL, "nope", "x")).toEqual([]);
  });
});
