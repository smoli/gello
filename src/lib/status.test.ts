import { describe, expect, it } from "vitest";
import { projectFolder, windowTitle } from "./status";

describe("projectFolder", () => {
  it("returns the basename and full path of the folder containing .gello", () => {
    expect(projectFolder("/Users/x/proj/.gello")).toEqual({
      name: "proj",
      path: "/Users/x/proj",
    });
  });

  it("handles a trailing slash", () => {
    expect(projectFolder("/a/b/gello-app/.gello/")).toEqual({
      name: "gello-app",
      path: "/a/b/gello-app",
    });
  });
});

describe("windowTitle (c0059)", () => {
  it("includes the branch in parentheses", () => {
    expect(windowTitle("/Users/x/proj/.gello", "main")).toBe("gello: proj (main)");
  });

  it("omits the parens entirely when not a git repo", () => {
    expect(windowTitle("/Users/x/proj/.gello", null)).toBe("gello: proj");
  });
});
