import { describe, expect, it } from "vitest";
import { parseBoardConfig } from "./cards";
import { removeBoardKey, setBoardKey } from "./boardyaml";

const RAW = `columns: [discuss, backlog, ready, in-progress, review, done]
# keep this comment
types: [task, issue]
wip_limits:
  in-progress: 2
`;

describe("setBoardKey", () => {
  it("appends a new top-level key, quoting values YAML would misread", () => {
    const out = setBoardKey(RAW, "background", "#1a2b3c");
    expect(out).toContain('background: "#1a2b3c"\n');
    // everything else byte-for-byte
    expect(out.startsWith(RAW)).toBe(true);
    // re-parses with the value intact
    expect(parseBoardConfig(out).config.background).toBe("#1a2b3c");
  });

  it("replaces an existing key in place, leaving other lines untouched", () => {
    const withBg = setBoardKey(RAW, "background", "background.png");
    const changed = setBoardKey(withBg, "background", "#000000");
    expect(changed).toContain('background: "#000000"\n');
    expect(changed).not.toContain("background.png");
    expect(changed).toContain("# keep this comment");
    expect(changed.match(/^background:/gm)).toHaveLength(1);
  });

  it("stores a gradient value (parens/commas) as a quoted scalar", () => {
    const out = setBoardKey(RAW, "background", "linear-gradient(45deg, #a, #b)");
    expect(parseBoardConfig(out).config.background).toBe(
      "linear-gradient(45deg, #a, #b)",
    );
  });

  it("leaves a plain relative image path unquoted", () => {
    const out = setBoardKey(RAW, "background", "assets/board/bg.jpg");
    expect(out).toContain("background: assets/board/bg.jpg\n");
  });
});

describe("removeBoardKey", () => {
  it("removes the line, preserving the rest byte-for-byte", () => {
    const withBg = setBoardKey(RAW, "background", "#000000");
    expect(removeBoardKey(withBg, "background")).toBe(RAW);
  });

  it("is a no-op when the key is absent", () => {
    expect(removeBoardKey(RAW, "background")).toBe(RAW);
  });
});
