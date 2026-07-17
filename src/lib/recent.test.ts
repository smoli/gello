import { describe, expect, it } from "vitest";
import { addRecent, normalizeRecent, parseRecent, serializeRecent } from "./recent";

describe("addRecent", () => {
  it("puts the newest project first", () => {
    expect(addRecent([], "/a")).toEqual(["/a"]);
    expect(addRecent(["/a"], "/b")).toEqual(["/b", "/a"]);
  });

  it("moves an existing project to the front without duplicating", () => {
    expect(addRecent(["/a", "/b", "/c"], "/b")).toEqual(["/b", "/a", "/c"]);
  });

  it("caps the list length (default 8), dropping the oldest", () => {
    const many = Array.from({ length: 8 }, (_, i) => `/p${i}`);
    const result = addRecent(many, "/new");
    expect(result).toHaveLength(8);
    expect(result[0]).toBe("/new");
    expect(result).not.toContain("/p7"); // oldest dropped
  });
});

describe("parseRecent / serializeRecent", () => {
  it("round-trips a list through the flag string", () => {
    const list = ["/a", "/b"];
    expect(parseRecent(serializeRecent(list))).toEqual(list);
  });

  it("parses null/garbage to an empty list", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent('{"not":"array"}')).toEqual([]);
  });

  it("keeps only string entries", () => {
    expect(parseRecent('["/a", 5, null, "/b"]')).toEqual(["/a", "/b"]);
  });
});

describe("normalizeRecent (i0020)", () => {
  it("strips a trailing .gello board dir (POSIX)", () => {
    expect(normalizeRecent(["/Users/x/proj/.gello"])).toEqual(["/Users/x/proj"]);
  });

  it("strips a trailing .gello board dir (Windows backslashes)", () => {
    expect(normalizeRecent(["C:\\ILC\\gello\\.gello"])).toEqual(["C:\\ILC\\gello"]);
  });

  it("tolerates a trailing separator", () => {
    expect(normalizeRecent(["/a/b/.gello/"])).toEqual(["/a/b"]);
    expect(normalizeRecent(["C:\\a\\b\\.gello\\"])).toEqual(["C:\\a\\b"]);
  });

  it("de-dups entries that collapse to the same project, preserving order", () => {
    expect(
      normalizeRecent(["/x/gello/.gello", "/x/gello", "/x/other"]),
    ).toEqual(["/x/gello", "/x/other"]);
  });

  it("passes through already-clean paths and paths without a .gello segment", () => {
    expect(normalizeRecent(["/x/proj", "C:\\x\\proj"])).toEqual([
      "/x/proj",
      "C:\\x\\proj",
    ]);
  });
});
