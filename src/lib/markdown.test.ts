import { describe, expect, it } from "vitest";
import {
  appendLogLine,
  countTaskItems,
  readSection,
  removeSection,
  replaceSection,
  retargetAssetLinks,
  splitLogSection,
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

describe("readSection / replaceSection (c0084)", () => {
  const EPIC_BODY =
    "\n## Goal\n\nShip dark theme.\n\n## Definition of done\n\n- [ ] toggle works\n";

  it("reads a section's content without its heading", () => {
    expect(readSection(EPIC_BODY, "Goal")).toBe("Ship dark theme.");
    expect(readSection(EPIC_BODY, "Definition of done")).toBe("- [ ] toggle works");
  });

  it("matches the heading case-insensitively", () => {
    expect(readSection(EPIC_BODY, "definition of DONE")).toBe("- [ ] toggle works");
  });

  it("returns an empty string for a missing or empty section", () => {
    expect(readSection(EPIC_BODY, "Plan")).toBe("");
    expect(readSection("\n## Goal\n\n", "Goal")).toBe("");
  });

  it("replaces a section and leaves every other line byte-for-byte", () => {
    const result = replaceSection(EPIC_BODY, "Goal", "Ship a dark theme, fully.");

    expect(result).toBe(
      "\n## Goal\n\nShip a dark theme, fully.\n\n## Definition of done\n\n- [ ] toggle works\n",
    );
  });

  it("replaces the last section without adding trailing blank lines", () => {
    const result = replaceSection(EPIC_BODY, "Definition of done", "- [x] done");

    expect(result).toBe(
      "\n## Goal\n\nShip dark theme.\n\n## Definition of done\n\n- [x] done\n",
    );
  });

  it("keeps the heading's own spelling when replacing", () => {
    const result = replaceSection("\n## Definition of Done\n\nx\n", "definition of done", "y");

    expect(result).toBe("\n## Definition of Done\n\ny\n");
  });

  it("appends the section when the body has none", () => {
    expect(replaceSection("\n## Goal\n\ng\n", "Definition of done", "- [ ] a")).toBe(
      "\n## Goal\n\ng\n\n## Definition of done\n\n- [ ] a\n",
    );
  });

  it("creates the section in an empty body", () => {
    expect(replaceSection("", "Goal", "g")).toBe("\n## Goal\n\ng\n");
  });

  it("empties a section without removing its heading", () => {
    expect(replaceSection(EPIC_BODY, "Goal", "  ")).toBe(
      "\n## Goal\n\n## Definition of done\n\n- [ ] toggle works\n",
    );
  });

  it("leaves sections it does not name alone, including a plan below", () => {
    const withPlan = `${EPIC_BODY}\n## Plan (steps + dependencies)\n\n1. Card — x\n`;

    const result = replaceSection(withPlan, "Goal", "New goal.");

    expect(result).toContain("## Plan (steps + dependencies)\n\n1. Card — x\n");
    expect(readSection(result, "Definition of done")).toBe("- [ ] toggle works");
  });

  it("round-trips: replacing a section with what it already holds is a no-op", () => {
    for (const heading of ["Goal", "Definition of done"]) {
      expect(replaceSection(EPIC_BODY, heading, readSection(EPIC_BODY, heading))).toBe(
        EPIC_BODY,
      );
    }
  });
});

describe("removeSection (c0151)", () => {
  const BODY =
    "\n## Goal\n\nShip dark theme.\n\n## References\n\n- [a](../a.pdf)\n\n## Log\n\n- created\n";

  it("cuts a section out and leaves the rest byte-for-byte", () => {
    expect(removeSection(BODY, "References")).toBe(
      "\n## Goal\n\nShip dark theme.\n\n## Log\n\n- created\n",
    );
  });

  it("cuts the last section without leaving trailing blank lines", () => {
    expect(removeSection("\n## Goal\n\ng\n\n## References\n\n- [a](../a.pdf)\n", "References")).toBe(
      "\n## Goal\n\ng\n",
    );
  });

  it("leaves a body without that heading alone", () => {
    expect(removeSection(BODY, "Plan")).toBe(BODY);
  });

  it("empties a body that is only that section", () => {
    expect(removeSection("## References\n\n- [a](../a.pdf)\n", "References")).toBe("");
  });
});
