import { describe, expect, it } from "vitest";
import { isLegacyBoard, planMigration } from "./migration";
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
      { path: "inbox/c003-z.md", content: "---\nid: c003\ntitle: Z\n---\n" },
    ];
    expect(isLegacyBoard(files)).toBe(false);
  });
});

describe("planMigration", () => {
  const files: BoardFile[] = [
    { path: "board.yaml", content: "columns: [ready]\n" },
    { path: "concept.md", content: "# concept\n" },
    { path: "inbox/c003-z.md", content: "---\nid: c003\ntitle: Z\nstatus: ready\n---\n" },
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

  it("does not touch inbox, cards, board.yaml or concept.md", () => {
    const { writes, deletes } = planMigration(files);
    const touched = [...writes.map((w) => w.path), ...deletes];
    expect(touched.some((p) => p.startsWith("inbox/"))).toBe(false);
    expect(touched).not.toContain("board.yaml");
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
