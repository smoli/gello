import { describe, expect, it } from "vitest";
import {
  appendLogLine,
  countTaskItems,
  retargetAssetLinks,
  splitLogSection,
  toggleTaskItem,
} from "./markdown";

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

An image ![issue](../assets/c042/issue.png) and a [file link](../assets/c042/log.txt).

Untouched: [absolute](/assets/x.png), [web](https://example.com/../assets/x.png),
and a plain mention of ../assets/c042/other.png outside link syntax.
`;

  it("rewrites markdown link/image targets from one asset prefix to another", () => {
    const result = retargetAssetLinks(RAW, "../assets/", "../../assets/");

    expect(result).toContain("![issue](../../assets/c042/issue.png)");
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

describe("appendLogLine (c042)", () => {
  it("appends to an existing Log section at its end", () => {
    const body = "\n## What\n\nText.\n\n## Log\n\n- 2026-07-16 created\n";

    const result = appendLogLine(body, "2026-07-17 status → done (app)");

    expect(result).toBe(
      "\n## What\n\nText.\n\n## Log\n\n- 2026-07-16 created\n- 2026-07-17 status → done (app)\n",
    );
  });

  it("creates the Log section when missing", () => {
    const result = appendLogLine("\nJust a note.\n", "2026-07-17 status → ready (app)");

    expect(result).toBe(
      "\nJust a note.\n\n## Log\n\n- 2026-07-17 status → ready (app)\n",
    );
  });

  it("inserts before a following section if Log is not last", () => {
    const body = "\n## Log\n\n- 2026-07-16 created\n\n## Notes\n\nn\n";

    const result = appendLogLine(body, "2026-07-17 status → done (app)");

    expect(result).toContain("- 2026-07-16 created\n- 2026-07-17 status → done (app)\n");
    expect(result).toContain("## Notes\n\nn\n");
  });

  it("works on an empty body", () => {
    const result = appendLogLine("", "2026-07-17 status → discuss (app)");

    expect(result).toBe("\n## Log\n\n- 2026-07-17 status → discuss (app)\n");
  });
});

describe("splitLogSection (c041)", () => {
  it("splits editable content from the Log section", () => {
    const body = "\n## What\n\nText.\n\n## Log\n\n- created\n";

    const { editable, log } = splitLogSection(body);

    expect(editable).toBe("\n## What\n\nText.\n\n");
    expect(log).toBe("## Log\n\n- created\n");
    expect(editable + log).toBe(body);
  });

  it("returns the whole body as editable when there is no Log", () => {
    const { editable, log } = splitLogSection("\nplain body\n");

    expect(editable).toBe("\nplain body\n");
    expect(log).toBe("");
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
