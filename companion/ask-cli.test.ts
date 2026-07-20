import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAsk } from "./ask-cli.ts";

const CARD = (id: string) =>
  `---\nid: ${id}\ntitle: Work\nstatus: in-progress\nupdated: 2026-07-01\n---\n\n## What\n\ntask\n`;

let dir: string; // the project dir; the board is dir/.gello
let root: string;
const out: string[] = [];

function ask(argv: string[], env: Record<string, string> = { GELLO_CARD_ID: "c001" }) {
  return runAsk(argv, env, dir, (m) => out.push(m));
}

const read = (rel: string) => readFileSync(join(root, rel), "utf8");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gello-ask-cli-"));
  root = join(dir, ".gello");
  mkdirSync(join(root, "cards"), { recursive: true });
  writeFileSync(join(root, "board.yaml"), "columns: [ready, in-progress, review]\n");
  writeFileSync(join(root, "cards/c001-work.md"), CARD("c001"));
  writeFileSync(join(root, "cards/c002-other.md"), CARD("c002"));
  out.length = 0;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("gello ask (c0102)", () => {
  it("parks the question on the run's card, taken from the environment", () => {
    expect(ask(["Which db?\n\n- [ ] Postgres"])).toBe(0);
    expect(read("cards/c001-work.md")).toContain("```gelloquestion\nWhich db?");
    expect(read("cards/c001-work.md")).toContain("awaiting: input");
  });

  it("joins multiple argument words into one question", () => {
    expect(ask(["Which", "db?"])).toBe(0);
    expect(read("cards/c001-work.md")).toContain("Which db?");
  });

  // the scoping rule: an agent cannot park a question on someone else's card,
  // even by naming it explicitly
  it("rejects a --card that is not the run's card", () => {
    expect(ask(["--card", "c002", "Which db?"])).toBe(1);
    expect(read("cards/c002-other.md")).not.toContain("gelloquestion");
    expect(out.join("\n")).toMatch(/c002/);
  });

  it("accepts a --card that matches the run's card", () => {
    expect(ask(["--card", "c001", "Which db?"])).toBe(0);
    expect(read("cards/c001-work.md")).toContain("gelloquestion");
  });

  it("fails when no card is in scope and none was given", () => {
    expect(ask(["Which db?"], {})).toBe(1);
    expect(out.join("\n")).toMatch(/card/i);
  });

  it("fails with usage when there is no question text", () => {
    expect(ask([])).toBe(1);
    expect(out.join("\n")).toMatch(/usage/i);
  });

  it("reports the refusal when a question is already open, without writing", () => {
    expect(ask(["First?"])).toBe(0);
    expect(ask(["Second?"])).toBe(1);
    expect(out.join("\n")).toMatch(/already/i);
    expect(read("cards/c001-work.md")).not.toContain("Second?");
  });

  it("fails when there is no board to write to", () => {
    rmSync(root, { recursive: true, force: true });
    expect(ask(["Which db?"])).toBe(1);
    expect(out.join("\n")).toMatch(/board/i);
  });
});
