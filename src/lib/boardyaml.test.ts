import { describe, expect, it } from "vitest";
import { parseBoardConfig } from "./cards";
import {
  removeBoardKey,
  removeTagColor,
  setBoardKey,
  setTagColor,
} from "./boardyaml";

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

describe("setTagColor / removeTagColor", () => {
  it("creates the tag_colors block when absent, quoting the #hex value", () => {
    const out = setTagColor(RAW, "ui", "#123456");
    expect(out.startsWith(RAW)).toBe(true);
    expect(out).toContain('tag_colors:\n  ui: "#123456"\n');
    expect(parseBoardConfig(out).config.tagColors).toEqual({ ui: "#123456" });
  });

  it("adds a second tag under an existing block", () => {
    const one = setTagColor(RAW, "ui", "#111111");
    const two = setTagColor(one, "agent-dx", "#222222");
    expect(parseBoardConfig(two).config.tagColors).toEqual({
      ui: "#111111",
      "agent-dx": "#222222",
    });
    // the block header is written once
    expect(two.match(/^tag_colors:/gm)).toHaveLength(1);
  });

  it("replaces a tag's colour in place, leaving siblings untouched", () => {
    const one = setTagColor(setTagColor(RAW, "ui", "#111111"), "docs", "#333333");
    const changed = setTagColor(one, "ui", "#999999");
    expect(parseBoardConfig(changed).config.tagColors).toEqual({
      ui: "#999999",
      docs: "#333333",
    });
    expect(changed.match(/^ {2}ui:/gm)).toHaveLength(1);
  });

  it("quotes a tag name YAML would misread", () => {
    const out = setTagColor(RAW, "needs: work", "#123456");
    expect(parseBoardConfig(out).config.tagColors).toEqual({
      "needs: work": "#123456",
    });
  });

  it("removes one tag, keeping the rest of the block", () => {
    const two = setTagColor(setTagColor(RAW, "ui", "#111111"), "docs", "#333333");
    const out = removeTagColor(two, "ui");
    expect(parseBoardConfig(out).config.tagColors).toEqual({ docs: "#333333" });
  });

  it("drops the whole block when the last tag is removed", () => {
    const one = setTagColor(RAW, "ui", "#111111");
    expect(removeTagColor(one, "ui")).toBe(RAW);
  });

  it("is a no-op when removing an absent tag", () => {
    const one = setTagColor(RAW, "ui", "#111111");
    expect(removeTagColor(one, "nope")).toBe(one);
    expect(removeTagColor(RAW, "ui")).toBe(RAW);
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
