import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/lib/board.ts";
import { claudeAdapter } from "./adapters.ts";
import { Runner } from "./runner.ts";
import { afkFileContent, afkPath, parseAfk, readAfk, syncAfk } from "./afk.ts";

function tempGello(): string {
  const root = join(
    tmpdir(),
    `gello-companion-afk-${process.pid}-${Math.random().toString(36).slice(2)}`,
    ".gello",
  );
  mkdirSync(root, { recursive: true });
  return root;
}

/** Write the flag file the way the app does (c0169 writes this content). */
function writeFlag(root: string, afk: boolean): void {
  const path = afkPath(root);
  mkdirSync(join(root, ".companion"), { recursive: true });
  writeFileSync(path, afkFileContent(afk));
}

const EMPTY_BOARD = loadBoard([
  { path: "board.yaml", content: "columns: [inbox, backlog, ready, in-progress, review, done]\n" },
]);

function makeRunner() {
  return new Runner({
    cwd: "/project",
    boardRoot: "/project/.gello",
    adapter: claudeAdapter,
    scope: "card",
    spawn: () => ({ onExit: () => {} }),
    reload: () => EMPTY_BOARD,
    onRuns: () => {},
  });
}

describe("afkPath", () => {
  it("is `.companion/afk.json` under the board root", () => {
    expect(afkPath("/p/.gello")).toBe(join("/p/.gello", ".companion", "afk.json"));
  });
});

describe("parseAfk", () => {
  it("reads the `afk` field", () => {
    expect(parseAfk('{"afk": true}')).toBe(true);
    expect(parseAfk('{"afk": false}')).toBe(false);
  });

  it("is off for anything it does not understand", () => {
    expect(parseAfk("")).toBe(false); // absent / empty
    expect(parseAfk("{")).toBe(false); // half-written
    expect(parseAfk("null")).toBe(false);
    expect(parseAfk("[]")).toBe(false);
    expect(parseAfk("{}")).toBe(false); // no field
    expect(parseAfk('{"afk": "true"}')).toBe(false); // not a boolean
  });
});

describe("readAfk", () => {
  it("is off when no flag file is present", () => {
    expect(readAfk(tempGello())).toBe(false);
  });

  it("round-trips what the app writes", () => {
    const root = tempGello();
    writeFlag(root, true);
    expect(readAfk(root)).toBe(true);
    writeFlag(root, false);
    expect(readAfk(root)).toBe(false);
  });

  it("is off when the file is unreadable garbage", () => {
    const root = tempGello();
    mkdirSync(join(root, ".companion"), { recursive: true });
    writeFileSync(afkPath(root), "not json at all");
    expect(readAfk(root)).toBe(false);
  });
});

describe("syncAfk", () => {
  it("applies the value only when it changed", () => {
    const root = tempGello();
    const applied: boolean[] = [];

    expect(syncAfk(root, false, (afk) => applied.push(afk))).toBe(false);
    expect(applied).toEqual([]); // no file, already off — nothing to apply

    writeFlag(root, true);
    expect(syncAfk(root, false, (afk) => applied.push(afk))).toBe(true);
    expect(applied).toEqual([true]);

    expect(syncAfk(root, true, (afk) => applied.push(afk))).toBe(true);
    expect(applied).toEqual([true]); // unchanged — not re-applied

    writeFlag(root, false);
    expect(syncAfk(root, true, (afk) => applied.push(afk))).toBe(false);
    expect(applied).toEqual([true, false]);
  });

  it("falls back to off when the flag file is deleted", () => {
    const root = tempGello();
    writeFlag(root, true);
    expect(syncAfk(root, false, () => {})).toBe(true);
    rmSync(afkPath(root));
    const applied: boolean[] = [];
    expect(syncAfk(root, true, (afk) => applied.push(afk))).toBe(false);
    expect(applied).toEqual([false]);
  });
});

describe("the runner's AFK state", () => {
  it("is off by default", () => {
    expect(makeRunner().isAfk()).toBe(false);
  });

  it("flips when the flag file on disk is toggled", () => {
    const root = tempGello();
    const runner = makeRunner();
    const apply = () => syncAfk(root, runner.isAfk(), (afk) => runner.setAfk(afk));

    apply(); // no file yet
    expect(runner.isAfk()).toBe(false);

    writeFlag(root, true);
    apply();
    expect(runner.isAfk()).toBe(true);

    writeFlag(root, false);
    apply();
    expect(runner.isAfk()).toBe(false);
  });
});
