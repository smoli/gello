import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadBoard,
  nextCardId,
  nextMilestoneId,
  withUpdatedCard,
  type BoardFile,
} from "./board";

// --- helpers -----------------------------------------------------------------

function file(path: string, content: string): BoardFile {
  return { path, content };
}

function card(id: string, status = "backlog", priority = "normal"): string {
  return `---\nid: ${id}\ntitle: Card ${id}\nstatus: ${status}\npriority: ${priority}\n---\nbody\n`;
}

function milestone(id: string, title = `Milestone ${id}`): string {
  return `---\nid: ${id}\ntitle: ${title}\n---\n## Goal\n`;
}

const SYNTHETIC: BoardFile[] = [
  file("board.yaml", "columns: [backlog, ready, in-progress, review, done]\nwip_limits:\n  in-progress: 2\n"),
  file("concept.md", "# not a card, ignored\n"),
  file("inbox/.gitkeep", ""),
  file("assets/c101/shot.png", "\x89PNG-binary-ignored"),
  file("inbox/c103-an-idea.md", card("c103")),
  file("milestones/m01-alpha/milestone.md", milestone("m01", "Alpha")),
  file("milestones/m01-alpha/c101-first.md", card("c101", "done", "low")),
  file("milestones/m01-alpha/c102-second.md", card("c102", "ready", "high")),
  file("milestones/m02-beta/milestone.md", milestone("m02", "Beta")),
  file("milestones/m02-beta/c104-broken.md", "---\nid: [unclosed\n---\nbody\n"),
  file("milestones/m02-beta/c105-no-id.md", "---\ntitle: No id here\nstatus: backlog\n---\nbody\n"),
];

// --- the dogfood test: gello loads its own board ------------------------------

describe("loadBoard on this repo's own .gello tree", () => {
  // vitest runs from the project root; jsdom rewrites import.meta.url to http
  const root = resolve(process.cwd(), ".gello");
  const files: BoardFile[] = readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const abs = join(entry.parentPath, entry.name);
      return file(relative(root, abs), readFileSync(abs, "utf8"));
    });

  const model = loadBoard(files);

  it("parses every file on our own board — zero invalid entries", () => {
    expect(model.invalid).toEqual([]);
  });

  it("finds the real milestones and cards", () => {
    expect(model.configError).toBeNull();
    expect(model.config.columns).toEqual([
      "backlog", "ready", "in-progress", "review", "done",
    ]);
    expect(model.config.wipLimits).toEqual({ "in-progress": 2 });
    expect(model.milestones.length).toBeGreaterThanOrEqual(5);
    const allCards = model.milestones.flatMap((group) => group.cards);
    expect(allCards.length).toBeGreaterThanOrEqual(19);
    expect(allCards.map((c) => c.id)).toContain("c001");
    for (const group of model.milestones) {
      expect(group.milestone).not.toBeNull();
    }
  });

  it("derives the next free IDs beyond the existing ones", () => {
    expect(nextCardId(model)).toMatch(/^c\d{3,}$/);
    expect(Number(nextCardId(model).slice(1))).toBeGreaterThanOrEqual(20);
    expect(Number(nextMilestoneId(model).slice(1))).toBeGreaterThanOrEqual(6);
  });
});

// --- synthetic tree ------------------------------------------------------------

describe("loadBoard on a synthetic tree", () => {
  const model = loadBoard(SYNTHETIC);

  it("represents inbox, milestone cards, and invalid cards", () => {
    expect(model.inbox.map((c) => c.id)).toEqual(["c103"]);
    expect(model.milestones.map((g) => g.folder)).toEqual([
      "m01-alpha",
      "m02-beta",
    ]);
    expect(model.milestones[0].milestone?.title).toBe("Alpha");
    expect(model.milestones[0].cards.map((c) => c.id)).toEqual(["c102", "c101"]);
    expect(model.invalid.map((entry) => entry.path)).toEqual([
      "milestones/m02-beta/c104-broken.md",
      "milestones/m02-beta/c105-no-id.md",
    ]);
  });

  it("ignores non-card files (config, concept, assets, .gitkeep)", () => {
    const mentioned = [
      ...model.inbox,
      ...model.milestones.flatMap((g) => g.cards),
    ].map((c) => c.path);
    expect(mentioned.every((p) => p.endsWith(".md"))).toBe(true);
    expect(model.invalid.map((e) => e.path)).not.toContain("concept.md");
  });

  it("orders cards by priority (high first), then id", () => {
    const files = [
      file("inbox/c202-normal.md", card("c202", "backlog", "normal")),
      file("inbox/c204-low.md", card("c204", "backlog", "low")),
      file("inbox/c203-high.md", card("c203", "backlog", "high")),
      file("inbox/c201-normal.md", card("c201", "backlog", "normal")),
    ];
    const ordered = loadBoard(files).inbox.map((c) => c.id);
    expect(ordered).toEqual(["c203", "c201", "c202", "c204"]);
  });

  it("derives next IDs, counting invalid files by filename", () => {
    // c104/c105 are invalid but their filenames still reserve the IDs
    expect(nextCardId(model)).toBe("c106");
    expect(nextMilestoneId(model)).toBe("m03");
  });
});

describe("withUpdatedCard", () => {
  it("replaces a milestone card by path without touching anything else", () => {
    const model = loadBoard(SYNTHETIC);
    const original = model.milestones[0].cards.find((c) => c.id === "c102")!;
    const updated = { ...original, status: "done" };

    const next = withUpdatedCard(model, updated);

    expect(
      next.milestones[0].cards.find((c) => c.id === "c102")?.status,
    ).toBe("done");
    // original model untouched (no mutation)
    expect(
      model.milestones[0].cards.find((c) => c.id === "c102")?.status,
    ).toBe("ready");
    expect(next.inbox).toEqual(model.inbox);
    expect(next.invalid).toEqual(model.invalid);
  });

  it("replaces an inbox card by path", () => {
    const model = loadBoard(SYNTHETIC);
    const updated = { ...model.inbox[0], status: "ready" };

    const next = withUpdatedCard(model, updated);

    expect(next.inbox[0].status).toBe("ready");
    expect(model.inbox[0].status).toBe("backlog");
  });
});

describe("loadBoard edge cases", () => {
  it("uses the default config when board.yaml is missing", () => {
    const model = loadBoard([file("inbox/c001-x.md", card("c001"))]);
    expect(model.config.columns).toContain("backlog");
    expect(model.configError).toBeNull();
  });

  it("surfaces a malformed board.yaml as configError with default config", () => {
    const model = loadBoard([file("board.yaml", "columns: [broken\n  nope")]);
    expect(model.configError).toMatch(/yaml/i);
    expect(model.config.columns).toContain("backlog");
  });

  it("validates card statuses against custom board.yaml columns", () => {
    const model = loadBoard([
      file("board.yaml", "columns: [todo, doing]\n"),
      file("inbox/c001-x.md", card("c001", "doing")),
      file("inbox/c002-y.md", card("c002", "backlog")),
    ]);
    expect(model.inbox.map((c) => c.id)).toEqual(["c001"]);
    expect(model.invalid).toHaveLength(1);
    expect(model.invalid[0].reason).toMatch(/status/i);
  });

  it("keeps a milestone folder without milestone.md, with a null milestone", () => {
    const model = loadBoard([
      file("milestones/m07-stray/c001-x.md", card("c001")),
    ]);
    expect(model.milestones).toHaveLength(1);
    expect(model.milestones[0].folder).toBe("m07-stray");
    expect(model.milestones[0].milestone).toBeNull();
    expect(model.milestones[0].cards.map((c) => c.id)).toEqual(["c001"]);
  });

  it("routes an invalid milestone.md to the invalid list", () => {
    const model = loadBoard([
      file("milestones/m01-x/milestone.md", "---\nid: m01\n---\nno title\n"),
    ]);
    expect(model.invalid).toHaveLength(1);
    expect(model.invalid[0].reason).toContain("title");
  });

  it("returns an empty model for an empty file list", () => {
    const model = loadBoard([]);
    expect(model.inbox).toEqual([]);
    expect(model.milestones).toEqual([]);
    expect(model.invalid).toEqual([]);
    expect(nextCardId(model)).toBe("c001");
    expect(nextMilestoneId(model)).toBe("m01");
  });
});
