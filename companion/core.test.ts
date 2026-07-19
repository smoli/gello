import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/lib/board.ts";
import {
  readBoardFiles,
  cardsEnteringReady,
  findBoardRoot,
  initialState,
  companionStatePath,
  writeStateFile,
  type CompanionState,
} from "./core.ts";

function tempGello(): string {
  const root = join(
    tmpdir(),
    `gello-companion-${process.pid}-${Math.random().toString(36).slice(2)}`,
    ".gello",
  );
  mkdirSync(root, { recursive: true });
  return root;
}

function write(root: string, rel: string, content: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

const card = (id: string, status: string) =>
  `---\nid: ${id}\ntitle: Card ${id}\nstatus: ${status}\n---\nbody\n`;

describe("readBoardFiles", () => {
  it("reads .gello files recursively with forward-slash relative paths", () => {
    const root = tempGello();
    write(root, "board.yaml", "columns: [inbox, backlog, ready, done]\n");
    write(root, "cards/c001-a.md", card("c001", "ready"));
    write(root, "epics/e01-x/epic.md", "---\nid: e01\ntitle: X\n---\ng\n");
    write(root, "epics/e01-x/c002-b.md", card("c002", "backlog"));

    const files = readBoardFiles(root);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("board.yaml");
    expect(paths).toContain("cards/c001-a.md");
    expect(paths).toContain("epics/e01-x/epic.md");
    expect(paths).toContain("epics/e01-x/c002-b.md");
    // paths use forward slashes even on Windows
    expect(paths.every((p) => !p.includes("\\"))).toBe(true);
    // content round-trips into the board model
    const model = loadBoard(files);
    expect(model.invalid).toEqual([]);
    expect(model.epics.map((e) => e.folder)).toContain("e01-x");
  });
});

describe("cardsEnteringReady", () => {
  const board = (statuses: Record<string, string>) =>
    loadBoard([
      { path: "board.yaml", content: "columns: [inbox, backlog, ready, done]\n" },
      ...Object.entries(statuses).map(([id, s]) => ({
        path: `cards/${id}-x.md`,
        content: card(id, s),
      })),
    ]);

  it("returns cards that newly entered ready", () => {
    const prev = board({ c001: "backlog", c002: "ready" });
    const next = board({ c001: "ready", c002: "ready" });
    const entered = cardsEnteringReady(prev, next);
    expect(entered.map((c) => c.id)).toEqual(["c001"]); // c002 was already ready
  });

  it("treats a brand-new ready card (absent before) as entering", () => {
    const prev = board({ c001: "backlog" });
    const next = board({ c001: "backlog", c003: "ready" });
    expect(cardsEnteringReady(prev, next).map((c) => c.id)).toEqual(["c003"]);
  });

  it("null previous model → every ready card counts as entering", () => {
    const next = board({ c001: "ready", c002: "backlog", c003: "ready" });
    expect(cardsEnteringReady(null, next).map((c) => c.id).sort()).toEqual([
      "c001",
      "c003",
    ]);
  });

  it("a card leaving ready is not reported", () => {
    const prev = board({ c001: "ready" });
    const next = board({ c001: "in-progress" });
    expect(cardsEnteringReady(prev, next)).toEqual([]);
  });
});

describe("findBoardRoot", () => {
  it("finds .gello walking up from a nested dir, else null", () => {
    const root = tempGello(); // <tmp>/<rand>/.gello
    const nested = join(root, "..", "some", "deep", "dir");
    mkdirSync(nested, { recursive: true });
    expect(findBoardRoot(nested)).toBe(root);
    expect(findBoardRoot(tmpdir())).toBeNull();
  });
});

describe("companion state file", () => {
  it("initialState is idle with empty runs", () => {
    const s = initialState("2026-07-19T10:00:00");
    expect(s.status).toBe("idle");
    expect(s.runs).toEqual([]);
    expect(s.updated).toBe("2026-07-19T10:00:00");
  });

  it("writes the state file atomically under .companion/", () => {
    const root = tempGello();
    expect(companionStatePath(root)).toBe(join(root, ".companion", "state.json"));

    const state: CompanionState = {
      status: "idle",
      ready: ["c001"],
      runs: [],
      updated: "2026-07-19T10:00:00",
    };
    writeStateFile(root, state);

    const path = companionStatePath(root);
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as CompanionState;
    expect(parsed).toEqual(state);
    // no leftover temp file beside it
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });
});
