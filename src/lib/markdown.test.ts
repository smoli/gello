import { describe, expect, it } from "vitest";
import { countTaskItems, toggleTaskItem } from "./markdown";

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
