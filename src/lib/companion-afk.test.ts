import { describe, expect, it } from "vitest";
import { afkFileContent, afkFilePath, parseAfk } from "./companion-afk";

// c0169: the app is the sole writer of `.companion/afk.json` (c0162), the
// companion the sole reader. These mirror companion/afk.ts — the file the app
// writes here must be the file the companion's parseAfk reads there.

describe("afkFilePath", () => {
  it("is afk.json beside the other app→companion traffic", () => {
    expect(afkFilePath("/repo/.gello")).toBe("/repo/.gello/.companion/afk.json");
  });
});

describe("afkFileContent", () => {
  it("writes the on state", () => {
    expect(JSON.parse(afkFileContent(true))).toEqual({ afk: true });
  });

  it("writes the off state explicitly, rather than an empty file", () => {
    expect(JSON.parse(afkFileContent(false))).toEqual({ afk: false });
  });

  it("ends in a newline", () => {
    expect(afkFileContent(true).endsWith("\n")).toBe(true);
  });
});

describe("parseAfk", () => {
  it("is on only for an explicit true", () => {
    expect(parseAfk('{"afk": true}')).toBe(true);
    expect(parseAfk('{"afk": false}')).toBe(false);
  });

  it("is off for anything unrecognised — the safe default", () => {
    expect(parseAfk("")).toBe(false);
    expect(parseAfk("half-writ")).toBe(false);
    expect(parseAfk("{}")).toBe(false);
    expect(parseAfk("null")).toBe(false);
    expect(parseAfk('{"afk": "yes"}')).toBe(false);
  });
});
