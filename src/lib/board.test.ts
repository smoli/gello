import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyFileChanges,
  findCardById,
  loadBoard,
  nextCardId,
  nextMilestoneId,
  openIssuesFor,
  withCardTriaged,
  withNewInboxCard,
  withUpdatedCard,
  type BoardFile,
} from "./board";
import { parseCard } from "./cards";

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
      "discuss", "backlog", "ready", "in-progress", "review", "done",
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

describe("withNewInboxCard", () => {
  it("adds the card to the inbox in sorted position", () => {
    const model = loadBoard(SYNTHETIC);
    const parsed = parseCard(
      "inbox/c106-urgent.md",
      card("c106", "backlog", "high"),
    );
    if (!parsed.ok) throw new Error("fixture must parse");

    const next = withNewInboxCard(model, parsed.card);

    // high priority sorts before the existing normal-priority c103
    expect(next.inbox.map((c) => c.id)).toEqual(["c106", "c103"]);
    expect(model.inbox.map((c) => c.id)).toEqual(["c103"]);
  });
});

describe("withCardTriaged", () => {
  it("moves a card from the inbox into a milestone group, sorted", () => {
    const model = loadBoard(SYNTHETIC);
    const parsed = parseCard(
      "milestones/m01-alpha/c103-an-idea.md",
      card("c103", "backlog", "high"),
    );
    if (!parsed.ok) throw new Error("fixture must parse");

    const next = withCardTriaged(model, "inbox/c103-an-idea.md", parsed.card, "m01-alpha");

    expect(next.inbox).toEqual([]);
    expect(next.milestones[0].cards.map((c) => c.id)).toEqual([
      "c102",
      "c103",
      "c101",
    ]);
    // original untouched
    expect(model.inbox.map((c) => c.id)).toEqual(["c103"]);
    expect(model.milestones[0].cards).toHaveLength(2);
  });
});

describe("applyFileChanges", () => {
  const model = loadBoard(SYNTHETIC);

  it("applies an external status edit to the model", () => {
    const changed = card("c101", "review", "low");
    const next = applyFileChanges(model, [
      { path: "milestones/m01-alpha/c101-first.md", content: changed },
    ]);

    expect(
      next.milestones[0].cards.find((c) => c.id === "c101")?.status,
    ).toBe("review");
  });

  it("returns the same reference when content matches the model (self-write echo)", () => {
    const existing = model.milestones[0].cards.find((c) => c.id === "c101")!;
    const next = applyFileChanges(model, [
      { path: existing.path, content: existing.raw },
    ]);

    expect(next).toBe(model);
  });

  it("adds a new card file", () => {
    const next = applyFileChanges(model, [
      { path: "inbox/c200-new.md", content: card("c200") },
    ]);

    expect(next.inbox.map((c) => c.id)).toContain("c200");
  });

  it("removes a deleted card file", () => {
    const next = applyFileChanges(model, [
      { path: "inbox/c103-an-idea.md", content: null },
    ]);

    expect(next.inbox).toEqual([]);
  });

  it("moves a card that became invalid into the invalid list", () => {
    const next = applyFileChanges(model, [
      { path: "milestones/m01-alpha/c101-first.md", content: "---\nbroken: [\n---\n" },
    ]);

    expect(next.milestones[0].cards.map((c) => c.id)).not.toContain("c101");
    expect(next.invalid.map((e) => e.path)).toContain(
      "milestones/m01-alpha/c101-first.md",
    );
  });

  it("heals a previously invalid file", () => {
    const next = applyFileChanges(model, [
      { path: "milestones/m02-beta/c104-broken.md", content: card("c104") },
    ]);

    expect(next.invalid.map((e) => e.path)).not.toContain(
      "milestones/m02-beta/c104-broken.md",
    );
    expect(next.milestones[1].cards.map((c) => c.id)).toContain("c104");
  });

  it("applies milestone.md and board.yaml changes", () => {
    const next = applyFileChanges(model, [
      {
        path: "milestones/m01-alpha/milestone.md",
        content: "---\nid: m01\ntitle: Alpha Renamed\n---\ngoal\n",
      },
      { path: "board.yaml", content: "columns: [todo, doing]\n" },
    ]);

    expect(next.milestones[0].milestone?.title).toBe("Alpha Renamed");
    expect(next.config.columns).toEqual(["todo", "doing"]);
    // cards whose status no longer exists become invalid under the new config
    expect(next.invalid.length).toBeGreaterThan(model.invalid.length);
  });

  it("ignores no-op deletions of unknown paths", () => {
    const next = applyFileChanges(model, [
      { path: "inbox/never-existed.md", content: null },
    ]);

    expect(next).toBe(model);
  });
});

describe("issue refs (c024)", () => {
  function issue(id: string, ref: string | null, status = "backlog"): string {
    return `---\nid: ${id}\ntitle: Issue ${id}\nstatus: ${status}\ntype: issue\n${
      ref ? `ref: ${ref}\n` : ""
    }---\nbody\n`;
  }

  const model = loadBoard([
    file("milestones/m01-x/c001-task.md", card("c001", "review")),
    file("milestones/m01-x/c002-issue-open.md", issue("c002", "c001")),
    file("milestones/m01-x/c003-issue-done.md", issue("c003", "c001", "done")),
    file("inbox/c004-issue-elsewhere.md", issue("c004", "c099")),
    file("inbox/c005-issue-unanchored.md", issue("c005", null)),
  ]);

  it("finds cards by id across inbox and milestones", () => {
    expect(findCardById(model, "c001")?.title).toBe("Card c001");
    expect(findCardById(model, "c005")?.path).toBe("inbox/c005-issue-unanchored.md");
    expect(findCardById(model, "c099")).toBeNull();
  });

  it("computes open issues pointing at a card, excluding done ones", () => {
    expect(openIssuesFor(model, "c001").map((c) => c.id)).toEqual(["c002"]);
    expect(openIssuesFor(model, "c005")).toEqual([]);
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
