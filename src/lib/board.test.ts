import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyFileChanges,
  findCardById,
  loadBoard,
  nextCardId,
  nextIssueId,
  nextEpicId,
  openIssuesFor,
  withCardTriaged,
  withNewInboxCard,
  withUpdatedCard,
  withoutCard,
  columnComparator,
  planManualInsert,
  type BoardFile,
} from "./board";
import { DEFAULT_BOARD_CONFIG, parseCard, type Card } from "./cards";

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
      // The Rust read_board_files command always emits forward-slash board
      // paths (fs_read.rs joins with "/"); mirror that so this test exercises
      // loadBoard's real contract on Windows too, where relative() uses "\".
      return file(relative(root, abs).replace(/\\/g, "/"), readFileSync(abs, "utf8"));
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
    expect(model.epics.length).toBeGreaterThanOrEqual(5);
    const allCards = model.epics.flatMap((group) => group.cards);
    expect(allCards.length).toBeGreaterThanOrEqual(19);
    expect(allCards.map((c) => c.id)).toContain("c001");
    for (const group of model.epics) {
      expect(group.epic).not.toBeNull();
    }
  });

  it("derives the next free IDs beyond the existing ones", () => {
    expect(nextCardId(model)).toMatch(/^c\d{3,}$/);
    expect(Number(nextCardId(model).slice(1))).toBeGreaterThanOrEqual(20);
    expect(Number(nextEpicId(model).slice(1))).toBeGreaterThanOrEqual(6);
  });
});

// --- synthetic tree ------------------------------------------------------------

describe("c0076: epic folders + standalone cards", () => {
  const model = loadBoard([
    file("board.yaml", "columns: [backlog, done]\n"),
    file("epics/e01-core/epic.md", "---\nid: e01\ntitle: Core\nstatus: backlog\n---\ngoal\n"),
    file("epics/e01-core/c001-a.md", "---\nid: c001\ntitle: In epic\nstatus: backlog\nepic: e01\n---\nx\n"),
    file("cards/c002-loose.md", "---\nid: c002\ntitle: Standalone\nstatus: backlog\n---\nx\n"),
    file("inbox/c003-idea.md", "---\nid: c003\ntitle: Idea\nstatus: backlog\n---\nx\n"),
    // legacy milestone folder still loads (compat, until migration)
    file("milestones/m09-old/milestone.md", "---\nid: m09\ntitle: Legacy\n---\ng\n"),
    file("milestones/m09-old/c004-b.md", "---\nid: c004\ntitle: Legacy card\nstatus: backlog\nmilestone: m09\n---\nx\n"),
  ]);

  it("reads epics/ (grouped), cards/ (standalone), inbox/, and legacy milestones/", () => {
    expect(model.invalid).toEqual([]);
    expect(model.epics.map((g) => g.folder)).toEqual(["e01-core", "m09-old"]);
    expect(model.epics[0].epic?.title).toBe("Core");
    expect(model.epics[0].cards.map((c) => c.id)).toEqual(["c001"]);
    expect(model.cards.map((c) => c.id)).toEqual(["c002"]); // standalone
    expect(model.inbox.map((c) => c.id)).toEqual(["c003"]);
  });

  it("maps legacy `milestone:` to `epic`, and standalone cards have no epic", () => {
    expect(model.epics[0].cards[0].epic).toBe("e01");
    expect(model.epics[1].cards[0].epic).toBe("m09"); // legacy milestone: mapped
    expect(model.cards[0].epic).toBeNull();
  });

  it("allocates epic ids in the e-namespace past legacy m-ids", () => {
    expect(nextEpicId(model)).toBe("e10"); // max(e01, m09) = 9 → e10
  });
});

describe("loadBoard on a synthetic tree", () => {
  const model = loadBoard(SYNTHETIC);

  it("represents inbox, milestone cards, and invalid cards", () => {
    expect(model.inbox.map((c) => c.id)).toEqual(["c103"]);
    expect(model.epics.map((g) => g.folder)).toEqual([
      "m01-alpha",
      "m02-beta",
    ]);
    expect(model.epics[0].epic?.title).toBe("Alpha");
    // c056: created/id order (no created in fixtures → id decides)
    expect(model.epics[0].cards.map((c) => c.id)).toEqual(["c101", "c102"]);
    expect(model.invalid.map((entry) => entry.path)).toEqual([
      "milestones/m02-beta/c104-broken.md",
      "milestones/m02-beta/c105-no-id.md",
    ]);
  });

  it("ignores non-card files (config, concept, assets, .gitkeep)", () => {
    const mentioned = [
      ...model.inbox,
      ...model.epics.flatMap((g) => g.cards),
    ].map((c) => c.path);
    expect(mentioned.every((p) => p.endsWith(".md"))).toBe(true);
    expect(model.invalid.map((e) => e.path)).not.toContain("concept.md");
  });

  // c056 superseded the old priority-first order: priority is display-only,
  // capture order (created, then id) is what the inbox shows.
  it("orders inbox cards by created/id regardless of priority", () => {
    const files = [
      file("inbox/c202-normal.md", card("c202", "backlog", "normal")),
      file("inbox/c204-low.md", card("c204", "backlog", "low")),
      file("inbox/c203-high.md", card("c203", "backlog", "high")),
      file("inbox/c201-normal.md", card("c201", "backlog", "normal")),
    ];
    const ordered = loadBoard(files).inbox.map((c) => c.id);
    expect(ordered).toEqual(["c201", "c202", "c203", "c204"]);
  });

  it("derives next IDs, counting invalid files by filename", () => {
    // c104/c105 are invalid but their filenames still reserve the IDs
    expect(nextCardId(model)).toBe("c0106");
    expect(nextEpicId(model)).toBe("e03");
  });
});

describe("withUpdatedCard", () => {
  it("replaces a milestone card by path without touching anything else", () => {
    const model = loadBoard(SYNTHETIC);
    const original = model.epics[0].cards.find((c) => c.id === "c102")!;
    const updated = { ...original, status: "done" };

    const next = withUpdatedCard(model, updated);

    expect(
      next.epics[0].cards.find((c) => c.id === "c102")?.status,
    ).toBe("done");
    // original model untouched (no mutation)
    expect(
      model.epics[0].cards.find((c) => c.id === "c102")?.status,
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

    // c056: capture order — priority does not jump the queue
    expect(next.inbox.map((c) => c.id)).toEqual(["c103", "c106"]);
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
    expect(next.epics[0].cards.map((c) => c.id)).toEqual([
      "c101",
      "c102",
      "c103",
    ]);
    // original untouched
    expect(model.inbox.map((c) => c.id)).toEqual(["c103"]);
    expect(model.epics[0].cards).toHaveLength(2);
  });

  it("i0005: re-triages a card between milestone groups without duplicating it", () => {
    const model = loadBoard(SYNTHETIC);
    const parsed = parseCard(
      "milestones/m02-beta/c102-second.md",
      card("c102", "ready", "high"),
    );
    if (!parsed.ok) throw new Error("fixture must parse");

    const next = withCardTriaged(
      model,
      "milestones/m01-alpha/c102-second.md",
      parsed.card,
      "m02-beta",
    );

    // gone from the source milestone, present exactly once in the target
    expect(next.epics[0].cards.map((c) => c.id)).toEqual(["c101"]);
    expect(next.epics[1].cards.filter((c) => c.id === "c102")).toHaveLength(1);
  });
});

describe("withoutCard (c0062)", () => {
  it("drops a card from its milestone group, leaving the rest", () => {
    const model = loadBoard(SYNTHETIC);

    const next = withoutCard(model, "milestones/m01-alpha/c101-first.md");

    expect(next.epics[0].cards.map((c) => c.id)).toEqual(["c102"]);
    // original untouched (immutability)
    expect(model.epics[0].cards).toHaveLength(2);
  });

  it("drops an inbox card", () => {
    const model = loadBoard(SYNTHETIC);
    expect(model.inbox.map((c) => c.id)).toEqual(["c103"]);

    const next = withoutCard(model, "inbox/c103-an-idea.md");

    expect(next.inbox).toEqual([]);
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
      next.epics[0].cards.find((c) => c.id === "c101")?.status,
    ).toBe("review");
  });

  it("returns the same reference when content matches the model (self-write echo)", () => {
    const existing = model.epics[0].cards.find((c) => c.id === "c101")!;
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

    expect(next.epics[0].cards.map((c) => c.id)).not.toContain("c101");
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
    expect(next.epics[1].cards.map((c) => c.id)).toContain("c104");
  });

  it("applies milestone.md and board.yaml changes", () => {
    const next = applyFileChanges(model, [
      {
        path: "milestones/m01-alpha/milestone.md",
        content: "---\nid: m01\ntitle: Alpha Renamed\n---\ngoal\n",
      },
      { path: "board.yaml", content: "columns: [todo, doing]\n" },
    ]);

    expect(next.epics[0].epic?.title).toBe("Alpha Renamed");
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

describe("4-digit id allocation (c044)", () => {
  it("pads new task and issue ids to 4 digits", () => {
    expect(nextCardId(loadBoard([]))).toBe("c0001");
    expect(nextIssueId(loadBoard([]))).toBe("i0001");
  });

  it("continues numerically after existing 3-digit ids without renumbering", () => {
    const model = loadBoard([file("inbox/c055-old.md", card("c055"))]);

    expect(nextCardId(model)).toBe("c0056");
  });

  it("sorts mixed-width ids numerically, not lexicographically", () => {
    const model = loadBoard([
      file("inbox/c0056-new.md", card("c0056")),
      file("inbox/c055-old.md", card("c055")),
    ]);

    // lexicographic would put c0056 first; numeric order is c055, c0056
    expect(model.inbox.map((c) => c.id)).toEqual(["c055", "c0056"]);
  });
});

describe("issue id namespace (c043)", () => {
  function issue(id: string): string {
    return `---\nid: ${id}\ntitle: Issue ${id}\nstatus: backlog\ntype: issue\n---\nx\n`;
  }

  it("allocates issue ids in the i-namespace, independent of tasks", () => {
    const model = loadBoard([
      file("inbox/c010-task.md", card("c010")),
      file("inbox/i002-issue.md", issue("i002")),
    ]);

    expect(nextIssueId(model)).toBe("i0003");
    expect(nextCardId(model)).toBe("c0011");
  });

  it("starts at i0001 on a board without issues", () => {
    expect(nextIssueId(loadBoard([]))).toBe("i0001");
  });

  it("counts invalid i-files by filename so broken issues reserve their id", () => {
    const model = loadBoard([
      file("inbox/i009-broken.md", "---\nid: [unclosed\n---\nx\n"),
    ]);

    expect(nextIssueId(model)).toBe("i0010");
  });
});

describe("duplicate card IDs (c031)", () => {
  it("keeps the first occurrence (by path) and flags the rest as invalid", () => {
    const model = loadBoard([
      file("inbox/c010-copy.md", card("c010", "backlog")),
      file("milestones/m01-a/milestone.md", "---\nid: m01\ntitle: A\n---\ng\n"),
      file("milestones/m01-a/c010-original.md", card("c010", "review")),
    ]);

    // "inbox/..." sorts before "milestones/..." — inbox copy wins
    expect(model.inbox.map((c) => c.id)).toEqual(["c010"]);
    expect(model.epics[0].cards).toEqual([]);
    expect(model.invalid).toHaveLength(1);
    expect(model.invalid[0].path).toBe("milestones/m01-a/c010-original.md");
    expect(model.invalid[0].reason).toContain("duplicate id c010");
    expect(model.invalid[0].reason).toContain("inbox/c010-copy.md");
  });

  it("flags every extra copy when an id appears three times", () => {
    const model = loadBoard([
      file("inbox/c010-a.md", card("c010")),
      file("inbox/c010-b.md", card("c010")),
      file("inbox/c010-c.md", card("c010")),
    ]);

    expect(model.inbox).toHaveLength(1);
    expect(model.invalid).toHaveLength(2);
    expect(model.invalid.every((e) => e.reason.includes("duplicate id"))).toBe(true);
  });

  it("does not reuse a duplicated id for the next card", () => {
    const model = loadBoard([
      file("inbox/c010-a.md", card("c010")),
      file("inbox/c010-b.md", card("c010")),
    ]);

    expect(nextCardId(model)).toBe("c0011");
  });

  it("propagates through applyFileChanges (watcher path)", () => {
    const model = loadBoard([file("inbox/c010-a.md", card("c010"))]);

    const next = applyFileChanges(model, [
      { path: "inbox/c010-b.md", content: card("c010") },
    ]);

    expect(next.invalid).toHaveLength(1);
    expect(next.invalid[0].reason).toContain("duplicate id c010");
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
    expect(model.epics).toHaveLength(1);
    expect(model.epics[0].folder).toBe("m07-stray");
    expect(model.epics[0].epic).toBeNull();
    expect(model.epics[0].cards.map((c) => c.id)).toEqual(["c001"]);
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
    expect(model.epics).toEqual([]);
    expect(model.invalid).toEqual([]);
    expect(nextCardId(model)).toBe("c0001");
    expect(nextEpicId(model)).toBe("e01");
  });
});

// --- per-column sorting (c056) -------------------------------------------------

function sortCard(
  id: string,
  fields: {
    status?: string;
    priority?: string;
    order?: number;
    statusChanged?: string;
    created?: string;
    updated?: string;
  } = {},
): Card {
  const lines = [
    `id: ${id}`,
    `title: Card ${id}`,
    `status: ${fields.status ?? "backlog"}`,
    `priority: ${fields.priority ?? "normal"}`,
  ];
  if (fields.order !== undefined) lines.push(`order: ${fields.order}`);
  if (fields.statusChanged) lines.push(`status-changed: ${fields.statusChanged}`);
  if (fields.created) lines.push(`created: ${fields.created}`);
  if (fields.updated) lines.push(`updated: ${fields.updated}`);
  const raw = `---\n${lines.join("\n")}\n---\nbody\n`;
  const config = {
    ...DEFAULT_BOARD_CONFIG,
    columns: ["discuss", "backlog", "ready", "in-progress", "review", "done", "custom"],
  };
  const result = parseCard(`inbox/${id}-x.md`, raw, config);
  if (!result.ok) throw new Error(`fixture must parse: ${result.invalid.reason}`);
  return result.card;
}

describe("columnComparator (c056)", () => {
  it("discuss sorts by created ascending, id as tiebreaker", () => {
    const a = sortCard("c002", { created: "2026-07-16" });
    const b = sortCard("c001", { created: "2026-07-17" });
    const c = sortCard("c003", { created: "2026-07-16" });
    const sorted = [b, c, a].sort(columnComparator("discuss"));
    expect(sorted.map((x) => x.id)).toEqual(["c002", "c003", "c001"]);
  });

  it("mixes day-only and datetime created values sensibly", () => {
    const old = sortCard("c001", { created: "2026-07-16" });
    const timed = sortCard("c002", { created: "2026-07-17T08:30:00" });
    expect([timed, old].sort(columnComparator("discuss")).map((x) => x.id)).toEqual([
      "c001",
      "c002",
    ]);
  });

  it("priority does not influence any column's order", () => {
    const low = sortCard("c001", { priority: "low", created: "2026-07-15" });
    const high = sortCard("c002", { priority: "high", created: "2026-07-16" });
    for (const column of ["discuss", "backlog", "in-progress"]) {
      expect([high, low].sort(columnComparator(column))[0].id).toBe("c001");
    }
  });

  it("backlog/ready sort by order ascending, unranked last by created/id", () => {
    const first = sortCard("c003", { order: 1 });
    const second = sortCard("c001", { order: 2.5 });
    const unrankedOld = sortCard("c004", { created: "2026-07-15" });
    const unrankedNew = sortCard("c002", { created: "2026-07-16" });
    const sorted = [unrankedNew, second, unrankedOld, first].sort(
      columnComparator("ready"),
    );
    expect(sorted.map((x) => x.id)).toEqual(["c003", "c001", "c004", "c002"]);
  });

  it("in-progress/review/done sort by status-changed, earliest first", () => {
    const later = sortCard("c001", { statusChanged: "2026-07-17T10:00:00" });
    const earlier = sortCard("c002", { statusChanged: "2026-07-17T08:00:00" });
    expect(
      [later, earlier].sort(columnComparator("done")).map((x) => x.id),
    ).toEqual(["c002", "c001"]);
  });

  it("falls back updated → created → id when status-changed is missing", () => {
    const stamped = sortCard("c001", { statusChanged: "2026-07-17T10:00:00" });
    const byUpdated = sortCard("c002", { updated: "2026-07-16", created: "2026-07-10" });
    const byCreated = sortCard("c003", { created: "2026-07-15" });
    const bare = sortCard("c004", {});
    const sorted = [stamped, bare, byUpdated, byCreated].sort(
      columnComparator("review"),
    );
    // bare (no dates at all) first, then created 07-15, updated 07-16, stamped 07-17
    expect(sorted.map((x) => x.id)).toEqual(["c004", "c003", "c002", "c001"]);
  });

  it("unknown custom columns use the status-changed rule", () => {
    const later = sortCard("c001", { statusChanged: "2026-07-17T10:00:00" });
    const earlier = sortCard("c002", { statusChanged: "2026-07-17T08:00:00" });
    expect(
      [later, earlier].sort(columnComparator("custom")).map((x) => x.id),
    ).toEqual(["c002", "c001"]);
  });
});

describe("planManualInsert (c056)", () => {
  it("between two ranked cards: midpoint, single write", () => {
    const cards = [sortCard("c001", { order: 10 }), sortCard("c002", { order: 20 })];
    const plan = planManualInsert(cards, 1);
    expect(plan.order).toBe(15);
    expect(plan.renumber).toBeUndefined();
  });

  it("at the top: below the first rank", () => {
    const cards = [sortCard("c001", { order: 10 }), sortCard("c002", { order: 20 })];
    const plan = planManualInsert(cards, 0);
    expect(plan.order).toBeLessThan(10);
    expect(plan.renumber).toBeUndefined();
  });

  it("after the last ranked card: above its rank", () => {
    const cards = [sortCard("c001", { order: 10 }), sortCard("c002", { order: 20 })];
    const plan = planManualInsert(cards, 2);
    expect(plan.order).toBeGreaterThan(20);
    expect(plan.renumber).toBeUndefined();
  });

  it("into an empty column: any rank, single write", () => {
    const plan = planManualInsert([], 0);
    expect(typeof plan.order).toBe("number");
    expect(plan.renumber).toBeUndefined();
  });

  it("between unranked cards: renumbers the column to make the position stick", () => {
    const a = sortCard("c001", { created: "2026-07-14" });
    const b = sortCard("c002", { created: "2026-07-15" });
    const plan = planManualInsert([a, b], 1);
    expect(plan.renumber).toBeDefined();
    const ranks = new Map(plan.renumber!.map((r) => [r.card.id, r.order]));
    // resulting sequence: c001, dragged, c002 — strictly increasing ranks
    expect(ranks.get("c001")!).toBeLessThan(plan.order);
    expect(plan.order).toBeLessThan(ranks.get("c002")!);
  });

  it("renumbers when the midpoint gap is exhausted", () => {
    const cards = [sortCard("c001", { order: 1 }), sortCard("c002", { order: 1 })];
    const plan = planManualInsert(cards, 1);
    expect(plan.renumber).toBeDefined();
  });
});

describe("loadBoard ordering (c056)", () => {
  it("sorts the inbox by created, not priority", () => {
    const model = loadBoard([
      file(
        "inbox/c201-late.md",
        "---\nid: c201\ntitle: Late\nstatus: backlog\npriority: high\ncreated: 2026-07-17\n---\n",
      ),
      file(
        "inbox/c202-early.md",
        "---\nid: c202\ntitle: Early\nstatus: backlog\npriority: low\ncreated: 2026-07-15\n---\n",
      ),
    ]);
    expect(model.inbox.map((c) => c.id)).toEqual(["c202", "c201"]);
  });
});
