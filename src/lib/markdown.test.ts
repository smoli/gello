import { describe, expect, it } from "vitest";
import { countTaskItems, retargetAssetLinks, toggleTaskItem } from "./markdown";

const BODY = `
## What

Some text with [ ] brackets that are not tasks.

## Acceptance criteria

- [ ] first criterion
- [x] second criterion
  - [ ] nested sub-task
- regular list item
- [ ] third criterion

## Notes

    - [ ] inside a code block, not a task
`;

describe("countTaskItems", () => {
  it("counts only real task list items, top-level and nested", () => {
    expect(countTaskItems(BODY)).toBe(4);
  });

  it("returns 0 for a body without tasks", () => {
    expect(countTaskItems("just text\n- plain item\n")).toBe(0);
  });
});

describe("retargetAssetLinks", () => {
  const RAW = `---
id: c042
---

An image ![bug](../assets/c042/bug.png) and a [file link](../assets/c042/log.txt).

Untouched: [absolute](/assets/x.png), [web](https://example.com/../assets/x.png),
and a plain mention of ../assets/c042/other.png outside link syntax.
`;

  it("rewrites markdown link/image targets from one asset prefix to another", () => {
    const result = retargetAssetLinks(RAW, "../assets/", "../../assets/");

    expect(result).toContain("![bug](../../assets/c042/bug.png)");
    expect(result).toContain("[file link](../../assets/c042/log.txt)");
  });

  it("leaves absolute urls, web urls, and non-link mentions alone", () => {
    const result = retargetAssetLinks(RAW, "../assets/", "../../assets/");

    expect(result).toContain("[absolute](/assets/x.png)");
    expect(result).toContain("https://example.com/../assets/");
    expect(result).toContain("a plain mention of ../assets/c042/other.png");
  });

  it("returns the input unchanged when no links match", () => {
    expect(retargetAssetLinks("no links here\n", "../assets/", "../../assets/")).toBe(
      "no links here\n",
    );
  });
});

describe("toggleTaskItem", () => {
  it("checks an unchecked item by document-order index, changing only that line", () => {
    const toggled = toggleTaskItem(BODY, 0);

    expect(toggled).toBe(BODY.replace("- [ ] first criterion", "- [x] first criterion"));
  });

  it("unchecks a checked item", () => {
    const toggled = toggleTaskItem(BODY, 1);

    expect(toggled).toBe(
      BODY.replace("- [x] second criterion", "- [ ] second criterion"),
    );
  });

  it("toggles nested task items", () => {
    const toggled = toggleTaskItem(BODY, 2);

    expect(toggled).toBe(
      BODY.replace("  - [ ] nested sub-task", "  - [x] nested sub-task"),
    );
  });

  it("treats an indented code block line as not a task", () => {
    const toggled = toggleTaskItem(BODY, 3);

    expect(toggled).toBe(BODY.replace("- [ ] third criterion", "- [x] third criterion"));
    expect(toggled).toContain("    - [ ] inside a code block, not a task");
  });

  it("throws on an out-of-range index", () => {
    expect(() => toggleTaskItem(BODY, 4)).toThrow(/index/i);
  });
});
