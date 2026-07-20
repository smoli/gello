import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setCardStatus } from "./set-status.ts";

// A ready card with a stale manual order — a status move should drop the order
// (it belonged to the column being left), exactly like an app move (c056).
const CARD =
  "---\nid: c001\ntitle: Work\nstatus: ready\norder: 3\nupdated: 2026-07-01\n---\n\n## What\n\ntask\n";

let root: string;

function board(cards: Record<string, string> = { "cards/c001-work.md": CARD }) {
  writeFileSync(join(root, "board.yaml"), "columns: [ready, in-progress, review]\n");
  mkdirSync(join(root, "cards"), { recursive: true });
  for (const [path, content] of Object.entries(cards)) {
    writeFileSync(join(root, path), content);
  }
}

const read = (path: string) => readFileSync(join(root, path), "utf8");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gello-status-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("setCardStatus (c0105)", () => {
  it("sets the status and stamps status-changed with a full datetime", () => {
    board();
    const card = setCardStatus(root, "c001", "in-progress");

    expect(card.status).toBe("in-progress");
    const written = read("cards/c001-work.md");
    expect(written).toContain("status: in-progress");
    expect(written).toMatch(/status-changed: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("drops a stale manual order (the rank belonged to the old column)", () => {
    board();
    setCardStatus(root, "c001", "in-progress");
    expect(read("cards/c001-work.md")).not.toContain("order:");
  });

  it("appends a dated Log line marking the agent move", () => {
    board();
    setCardStatus(root, "c001", "review");
    expect(read("cards/c001-work.md")).toMatch(
      /- \d{4}-\d{2}-\d{2} status → review \(agent\)/,
    );
  });

  it("keeps the existing body", () => {
    board();
    setCardStatus(root, "c001", "in-progress");
    expect(read("cards/c001-work.md")).toContain("## What");
  });

  it("refuses an unknown status", () => {
    board();
    expect(() => setCardStatus(root, "c001", "nope")).toThrow(/nope/);
    // nothing written — the card keeps its original status
    expect(read("cards/c001-work.md")).toContain("status: ready");
  });

  it("refuses an unknown card id (scoping)", () => {
    board();
    expect(() => setCardStatus(root, "c999", "in-progress")).toThrow(/c999/);
  });

  it("is a no-op when the card already has that status", () => {
    board();
    const before = read("cards/c001-work.md");
    const card = setCardStatus(root, "c001", "ready");
    expect(card.status).toBe("ready");
    // unchanged file: no re-stamp, no dropped order, no duplicate Log line
    expect(read("cards/c001-work.md")).toBe(before);
  });

  it("writes atomically, leaving no temp file behind", () => {
    board();
    setCardStatus(root, "c001", "in-progress");
    expect(() => read("cards/c001-work.md.gello-tmp")).toThrow();
  });
});
