import { describe, expect, it } from "vitest";
import { QUEUE_LINES, queueLine } from "./queue-lines";

describe("queue lines (c0143)", () => {
  it("holds exactly 50 lines", () => {
    expect(QUEUE_LINES).toHaveLength(50);
  });

  it("picks a line from the list", () => {
    expect(QUEUE_LINES).toContain(queueLine("c0141"));
  });

  it("is stable for a given id — the same line across polls, no flicker", () => {
    expect(queueLine("i0125")).toBe(queueLine("i0125"));
    expect(queueLine("c0142")).toBe(queueLine("c0142"));
  });

  it("is picked by hash % 50, so different ids can land on different lines", () => {
    const lines = new Set(
      ["c0001", "c0002", "c0003", "i0010", "i0020", "c0143"].map(queueLine),
    );
    // not a constant — the id genuinely drives the choice
    expect(lines.size).toBeGreaterThan(1);
  });

  it("indexes strictly inside the list (hash % 50 is in range)", () => {
    for (const id of ["a", "c0000", "i9999", "zzz", ""]) {
      expect(QUEUE_LINES).toContain(queueLine(id));
    }
  });
});
