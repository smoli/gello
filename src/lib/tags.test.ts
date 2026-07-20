import { describe, expect, it } from "vitest";
import { loadBoard, type BoardFile } from "./board";
import {
  autoTagColor,
  collectTags,
  planTagRename,
  readableTextColor,
  renameTagInList,
  shadeColor,
  tagChipStyle,
  tagColor,
  tintColor,
  TAG_PALETTE,
} from "./tags";

/** Perceived luminance (0–255) of a "#rrggbb" hex — for ordering fills. */
function luminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

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

describe("readableTextColor", () => {
  it("picks dark text on light backgrounds and light text on dark ones", () => {
    expect(readableTextColor("#ffffff")).toBe("#111111");
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#ca8a04")).toBe("#111111"); // amber → dark text
    expect(readableTextColor("#4f46e5")).toBe("#ffffff"); // indigo → light text
  });

  it("tolerates a 3-digit hex or a missing hash", () => {
    expect(readableTextColor("#fff")).toBe("#111111");
    expect(readableTextColor("000")).toBe("#ffffff");
  });
});

describe("tintColor", () => {
  it("mixes a colour toward white by the given amount", () => {
    expect(tintColor("#000000", 0)).toBe("#000000");
    expect(tintColor("#000000", 1)).toBe("#ffffff");
    expect(tintColor("#000000", 0.5)).toBe("#808080");
  });

  it("keeps a legible pale fill: a tinted chip takes dark text (i0110)", () => {
    // bright tags that read poorly as raw-coloured text over a board photo
    for (const colour of ["#65a30d", "#0ea5e9", "#ca8a04"]) {
      const fill = tintColor(colour, 0.82);
      expect(readableTextColor(fill)).toBe("#111111");
    }
  });

  it("tolerates a 3-digit hex or a missing hash", () => {
    expect(tintColor("#fff", 0.5)).toBe("#ffffff");
    expect(tintColor("000", 0)).toBe("#000000");
  });
});

describe("shadeColor", () => {
  it("mixes a colour toward a dark base by the given amount", () => {
    expect(shadeColor("#ffffff", 0)).toBe("#ffffff");
    // full mix lands on the dark base, whatever the input hue
    expect(shadeColor("#ffffff", 1)).toBe(shadeColor("#000000", 1));
  });

  it("keeps a dark fill that takes light text (i0114)", () => {
    // the same bright tags that read pale over a light board go dark here
    for (const colour of ["#65a30d", "#0ea5e9", "#ca8a04"]) {
      const fill = shadeColor(colour, 0.72);
      expect(readableTextColor(fill)).toBe("#ffffff");
    }
  });

  it("tolerates a 3-digit hex or a missing hash", () => {
    expect(shadeColor("fff", 0)).toBe("#ffffff");
    expect(shadeColor("#000", 0)).toBe("#000000");
  });
});

describe("tagChipStyle", () => {
  it("is the resting chip look: pale tinted fill, tag-colour border, legible text (i0113)", () => {
    const style = tagChipStyle("#65a30d");
    expect(style.backgroundColor).toBe(tintColor("#65a30d", 0.82));
    expect(style.borderColor).toBe("#65a30d");
    expect(style.color).toBe(readableTextColor(style.backgroundColor));
  });

  it("picks dark text for the pale fill of any bright tag", () => {
    for (const colour of ["#65a30d", "#0ea5e9", "#ca8a04"]) {
      expect(tagChipStyle(colour).color).toBe("#111111");
    }
  });

  it("shades the fill dark and text light in dark mode, keeping the tag-colour border (i0114)", () => {
    const style = tagChipStyle("#65a30d", true);
    expect(style.backgroundColor).toBe(shadeColor("#65a30d", 0.72));
    expect(style.borderColor).toBe("#65a30d");
    expect(style.color).toBe(readableTextColor(style.backgroundColor));
  });

  it("gives every palette tag a dark fill with light text in dark mode (i0114)", () => {
    for (const colour of TAG_PALETTE) {
      const style = tagChipStyle(colour, true);
      // darker than the light-mode fill for the same tag…
      expect(luminance(style.backgroundColor)).toBeLessThan(
        luminance(tagChipStyle(colour).backgroundColor),
      );
      // …and legible with light text
      expect(style.color).toBe("#ffffff");
    }
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
