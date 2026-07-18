import { describe, expect, it } from "vitest";
import { addInboxColumn, isLegacyBoard, planMigration } from "./migration";
import { loadBoard, type BoardFile } from "./board";

const MILESTONE_MD = `---
id: m06
title: Epic model
status: backlog
---

## Goal

Rename the **milestone** concept. See [[c0074]].
`;

const CARD_MD = `---
id: c0079
title: Migration engine
status: ready
milestone: m06
depends: [c0076]
created: 2026-07-18
updated: 2026-07-18
---

## What

![shot](../../assets/c0079/shot.png)
`;

describe("isLegacyBoard", () => {
  it("detects a milestones/ tree", () => {
    const files: BoardFile[] = [
      { path: "milestones/m06-epics/milestone.md", content: MILESTONE_MD },
    ];
    expect(isLegacyBoard(files)).toBe(true);
  });

  it("detects a stray milestone: frontmatter field even without a milestones/ folder", () => {
    const files: BoardFile[] = [
      { path: "inbox/c001-x.md", content: "---\nid: c001\ntitle: X\nmilestone: m01\n---\n" },
    ];
    expect(isLegacyBoard(files)).toBe(true);
  });

  it("does not flag a milestone: mention in the body prose", () => {
    const files: BoardFile[] = [
      {
        path: "cards/c001-x.md",
        content: "---\nid: c001\ntitle: X\n---\n\nWe renamed milestone: to epic.\n",
      },
    ];
    expect(isLegacyBoard(files)).toBe(false);
  });

  it("returns false for a pure epic-format board", () => {
    const files: BoardFile[] = [
      { path: "epics/e06-epics/epic.md", content: "---\nid: e06\ntitle: T\n---\n" },
      { path: "epics/e06-epics/c001-x.md", content: "---\nid: c001\ntitle: X\nepic: e06\n---\n" },
      { path: "cards/c002-y.md", content: "---\nid: c002\ntitle: Y\n---\n" },
      { path: "cards/c003-z.md", content: "---\nid: c003\ntitle: Z\n---\n" },
    ];
    expect(isLegacyBoard(files)).toBe(false);
  });
});

describe("planMigration", () => {
  const files: BoardFile[] = [
    // already inbox-migrated (inbox column present), so these tests isolate the
    // milestone→epic transform
    { path: "board.yaml", content: "columns: [inbox, ready]\n" },
    { path: "concept.md", content: "# concept\n" },
    { path: "cards/c003-z.md", content: "---\nid: c003\ntitle: Z\nstatus: ready\n---\n" },
    { path: "milestones/m06-epics/milestone.md", content: MILESTONE_MD },
    { path: "milestones/m06-epics/c0079-migration-engine.md", content: CARD_MD },
    { path: "milestones/m01-foundation/milestone.md", content: "---\nid: m01\ntitle: F\n---\n" },
  ];

  it("renames milestone.md → epic.md and remaps its id mNN → eNN", () => {
    const { writes } = planMigration(files);
    const epic = writes.find((w) => w.path === "epics/e06-epics/epic.md");
    expect(epic).toBeDefined();
    expect(epic!.content).toContain("id: e06");
    expect(epic!.content).not.toContain("id: m06");
    // body prose is preserved untouched
    expect(epic!.content).toContain("Rename the **milestone** concept.");
    expect(epic!.content).toContain("[[c0074]]");
  });

  it("renames a card's milestone: field to epic: and remaps the value", () => {
    const { writes } = planMigration(files);
    const card = writes.find(
      (w) => w.path === "epics/e06-epics/c0079-migration-engine.md",
    );
    expect(card).toBeDefined();
    expect(card!.content).toContain("epic: e06");
    expect(card!.content).not.toMatch(/^milestone:/m);
    // card id and every other line survive byte-for-byte
    expect(card!.content).toContain("id: c0079");
    expect(card!.content).toContain("depends: [c0076]");
    expect(card!.content).toContain("status: ready");
  });

  it("remaps a legacy value under the new epic: key too (epic: mNN → epic: eNN)", () => {
    // a card written during the epic transition used the new `epic:` key but
    // still held a legacy `mNN` id — it must be remapped, not left as-is.
    const withEpicKey: BoardFile[] = [
      {
        path: "milestones/m06-epics/i0026-x.md",
        content: "---\nid: i0026\ntitle: X\nstatus: ready\nepic: m06\n---\nbody\n",
      },
    ];
    const { writes } = planMigration(withEpicKey);
    expect(writes[0].path).toBe("epics/e06-epics/i0026-x.md");
    expect(writes[0].content).toContain("epic: e06");
    expect(writes[0].content).not.toContain("m06");
  });

  it("leaves relative asset links unchanged (folder depth is preserved)", () => {
    const { writes } = planMigration(files);
    const card = writes.find(
      (w) => w.path === "epics/e06-epics/c0079-migration-engine.md",
    );
    expect(card!.content).toContain("![shot](../../assets/c0079/shot.png)");
  });

  it("remaps every milestone folder independently", () => {
    const { writes } = planMigration(files);
    expect(writes.map((w) => w.path).sort()).toEqual([
      "epics/e01-foundation/epic.md",
      "epics/e06-epics/c0079-migration-engine.md",
      "epics/e06-epics/epic.md",
    ]);
  });

  it("deletes exactly the old milestones/ files (nothing outside the tree)", () => {
    const { deletes } = planMigration(files);
    expect(deletes.sort()).toEqual([
      "milestones/m01-foundation/milestone.md",
      "milestones/m06-epics/c0079-migration-engine.md",
      "milestones/m06-epics/milestone.md",
    ]);
  });

  it("does not touch standalone cards, an inbox-ready board.yaml, or concept.md", () => {
    const { writes, deletes } = planMigration(files);
    const touched = [...writes.map((w) => w.path), ...deletes];
    expect(touched.some((p) => p.startsWith("cards/"))).toBe(false);
    expect(touched).not.toContain("board.yaml"); // already has inbox column
    expect(touched).not.toContain("concept.md");
  });

  it("is idempotent on its own output (re-running yields no epics-side churn)", () => {
    // A board already migrated has no milestones/ files → empty plan.
    const migrated = planMigration(files).writes;
    const second = planMigration(migrated);
    expect(second.writes).toEqual([]);
    expect(second.deletes).toEqual([]);
  });

  it("post-migration the board loads with zero invalid files and epic ids remapped", () => {
    const plan = planMigration(files);
    // apply the plan: drop the deleted milestones files, add the new writes
    const untouched = files.filter((f) => !plan.deletes.includes(f.path));
    const migratedFiles = [...untouched, ...plan.writes];

    const model = loadBoard(migratedFiles);

    expect(model.invalid).toEqual([]);
    expect(isLegacyBoard(migratedFiles)).toBe(false);
    expect(model.epics.map((g) => g.folder).sort()).toEqual([
      "e01-foundation",
      "e06-epics",
    ]);
    const e06 = model.epics.find((g) => g.folder === "e06-epics")!;
    expect(e06.epic?.id).toBe("e06");
    expect(e06.cards.map((c) => ({ id: c.id, epic: c.epic }))).toEqual([
      { id: "c0079", epic: "e06" },
    ]);
  });
});

describe("inbox → cards migration (c0091)", () => {
  const files: BoardFile[] = [
    { path: "board.yaml", content: "columns: [discuss, backlog, ready, done]\n" },
    { path: "inbox/c010-idea.md", content: "---\nid: c010\ntitle: Idea\nstatus: backlog\n---\nx\n" },
    { path: "inbox/c011-flagged.md", content: "---\nid: c011\ntitle: Flagged\nstatus: discuss\n---\nx\n" },
    { path: "cards/c012-loose.md", content: "---\nid: c012\ntitle: Loose\nstatus: backlog\n---\nx\n" },
  ];

  it("detects an inbox/ folder as legacy", () => {
    expect(isLegacyBoard(files)).toBe(true);
    expect(isLegacyBoard([{ path: "cards/c1.md", content: "---\nid: c1\ntitle: X\n---\n" }])).toBe(false);
  });

  it("moves inbox/*.md to cards/, mapping backlog → inbox and preserving other statuses", () => {
    const { writes, deletes } = planMigration(files);
    const idea = writes.find((w) => w.path === "cards/c010-idea.md")!;
    expect(idea.content).toContain("status: inbox"); // backlog → inbox
    const flagged = writes.find((w) => w.path === "cards/c011-flagged.md")!;
    expect(flagged.content).toContain("status: discuss"); // preserved (old c030)
    expect(deletes).toEqual(
      expect.arrayContaining(["inbox/c010-idea.md", "inbox/c011-flagged.md"]),
    );
    // the already-standalone card is untouched
    expect(writes.find((w) => w.path === "cards/c012-loose.md")).toBeUndefined();
  });

  it("prepends inbox to board.yaml's columns", () => {
    const { writes } = planMigration(files);
    const yaml = writes.find((w) => w.path === "board.yaml")!;
    expect(yaml.content).toContain("columns: [inbox, discuss, backlog, ready, done]");
  });

  it("addInboxColumn is idempotent", () => {
    expect(addInboxColumn("columns: [inbox, backlog]\n")).toBe("columns: [inbox, backlog]\n");
  });

  it("post-migration the board loads with zero invalid, inbox cards standalone", () => {
    const plan = planMigration(files);
    const untouched = files.filter((f) => !plan.deletes.includes(f.path));
    const migrated = [
      ...untouched.filter((f) => !plan.writes.some((w) => w.path === f.path)),
      ...plan.writes,
    ];
    const model = loadBoard(migrated);
    expect(model.invalid).toEqual([]);
    expect(isLegacyBoard(migrated)).toBe(false);
    expect(model.cards.map((c) => c.id).sort()).toEqual(["c010", "c011", "c012"]);
    expect(model.cards.find((c) => c.id === "c010")?.status).toBe("inbox");
    expect(model.config.columns[0]).toBe("inbox");
  });
});
