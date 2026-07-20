import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { askQuestion } from "./ask.ts";

const CARD =
  "---\nid: c001\ntitle: Work\nstatus: in-progress\nupdated: 2026-07-01\n---\n\n## What\n\ntask\n";

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
  root = mkdtempSync(join(tmpdir(), "gello-ask-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("askQuestion (c0102)", () => {
  it("writes the gelloquestion fence and the awaiting marker to the card file", () => {
    board();
    askQuestion(root, "c001", "Which db?\n\n- [ ] Postgres\n- [ ] SQLite");

    const written = read("cards/c001-work.md");
    expect(written).toContain("```gelloquestion\nWhich db?");
    expect(written).toContain("- [ ] SQLite\n```");
    expect(written).toContain("awaiting: input");
    expect(written).toContain("## What"); // the existing body survives
  });

  it("returns the card it parked the question on", () => {
    board();
    expect(askQuestion(root, "c001", "Which db?").id).toBe("c001");
  });

  // scoping: the tool surfaces pass the run's card id, and an agent that names
  // some other card must not be able to write to it
  it("refuses an unknown card id", () => {
    board();
    expect(() => askQuestion(root, "c999", "Which db?")).toThrow(/c999/);
  });

  // one turn at a time — replacing an unanswered block would silently drop a
  // question the human has not seen
  it("refuses a second question while one is still open", () => {
    board();
    askQuestion(root, "c001", "First?");
    expect(() => askQuestion(root, "c001", "Second?")).toThrow(/already/i);
    expect(read("cards/c001-work.md")).not.toContain("Second?");
  });

  it("refuses empty question markdown", () => {
    board();
    expect(() => askQuestion(root, "c001", "   ")).toThrow(/empty/i);
  });

  it("writes atomically, leaving no temp file behind", () => {
    board();
    askQuestion(root, "c001", "Which db?");
    expect(read("cards/c001-work.md")).toContain("gelloquestion");
    expect(() => read("cards/c001-work.md.gello-tmp")).toThrow();
  });
});
