import { describe, expect, it } from "vitest";
import { phraseActivity, cardActivity } from "./activity";
import type { CompanionState } from "./companion";

// --- phraseActivity ---------------------------------------------------------

describe("phraseActivity", () => {
  it("maps each known tool to its verb", () => {
    expect(phraseActivity({ name: "Edit", arg: "src/runner.ts" })).toBe("Editing runner.ts");
    expect(phraseActivity({ name: "Write", arg: "src/new.ts" })).toBe("Editing new.ts");
    expect(phraseActivity({ name: "Read", arg: "src/board.ts" })).toBe("Reading board.ts");
    expect(phraseActivity({ name: "Bash", arg: "pnpm test" })).toBe("Running pnpm test");
    expect(phraseActivity({ name: "Grep", arg: "status:" })).toBe("Searching status:");
    expect(phraseActivity({ name: "Glob", arg: "**/*.ts" })).toBe("Searching **/*.ts");
  });

  it("phrases the gello MCP tools by their bare name", () => {
    expect(phraseActivity({ name: "mcp__gello__set_status", arg: "review" })).toBe(
      "Updating status",
    );
    expect(phraseActivity({ name: "mcp__gello__add_question", arg: "# Which?" })).toBe(
      "Asking a question",
    );
  });

  it("prefers a path's basename for file tools", () => {
    expect(phraseActivity({ name: "Read", arg: "/a/b/c/deep.ts" })).toBe("Reading deep.ts");
    expect(phraseActivity({ name: "Edit", arg: "just.ts" })).toBe("Editing just.ts");
  });

  it("does not basename a command or pattern argument", () => {
    // a Bash command with a slash is not a path to shorten
    expect(phraseActivity({ name: "Bash", arg: "ls src/lib" })).toBe("Running ls src/lib");
  });

  it("truncates a very long argument to one bounded line", () => {
    const out = phraseActivity({ name: "Bash", arg: "x".repeat(500) });
    expect(out.length).toBeLessThan(80);
    expect(out).toContain("…");
  });

  it("collapses newlines in an argument", () => {
    expect(phraseActivity({ name: "Bash", arg: "cd foo\nrm bar" })).toBe("Running cd foo rm bar");
  });

  it("falls back to the tool name for an unknown tool", () => {
    expect(phraseActivity({ name: "WebFetch", arg: "https://x.test" })).toBe(
      "WebFetch https://x.test",
    );
    expect(phraseActivity({ name: "TodoWrite" })).toBe("TodoWrite");
  });

  it("shows just the verb when a tool has no argument", () => {
    expect(phraseActivity({ name: "Bash" })).toBe("Running");
  });
});

// --- cardActivity -----------------------------------------------------------

function state(over: Partial<CompanionState> = {}): CompanionState {
  return {
    status: "running",
    ready: [],
    waiting: [],
    runs: [],
    updated: "2026-07-20T12:00:00",
    ...over,
  };
}

const NOW = Date.parse("2026-07-20T12:00:05"); // 5s after `updated`

describe("cardActivity", () => {
  it("returns null when the companion isn't running (no state)", () => {
    expect(cardActivity(null, "c001", NOW)).toBeNull();
  });

  it("returns null for a card with no run", () => {
    expect(cardActivity(state(), "c001", NOW)).toBeNull();
  });

  it("phrases a running run's latest tool call", () => {
    const s = state({
      runs: [{ cardId: "c001", phase: "running", activity: { name: "Edit", arg: "src/x.ts" } }],
    });
    expect(cardActivity(s, "c001", NOW)).toEqual({ label: "Editing x.ts", stale: false });
  });

  it("shows Thinking… for a running run with no tool call yet", () => {
    const s = state({ runs: [{ cardId: "c001", phase: "running" }] });
    expect(cardActivity(s, "c001", NOW)).toEqual({ label: "Thinking…", stale: false });
  });

  it("returns null for a parked (waiting-for-input) run", () => {
    const s = state({
      runs: [{ cardId: "c001", phase: "waiting-for-input", activity: { name: "Bash", arg: "x" } }],
    });
    expect(cardActivity(s, "c001", NOW)).toBeNull();
  });

  it("returns null for a done or errored run", () => {
    for (const phase of ["done", "error"] as const) {
      const s = state({ runs: [{ cardId: "c001", phase }] });
      expect(cardActivity(s, "c001", NOW)).toBeNull();
    }
  });

  it("marks the line stale when the state file's updated is older than ~30s", () => {
    const s = state({
      updated: "2026-07-20T12:00:00",
      runs: [{ cardId: "c001", phase: "running", activity: { name: "Bash", arg: "pnpm test" } }],
    });
    const late = Date.parse("2026-07-20T12:00:40"); // 40s later
    expect(cardActivity(s, "c001", late)).toEqual({ label: "Running pnpm test", stale: true });
  });

  it("treats an unparseable updated timestamp as stale", () => {
    const s = state({
      updated: "not a date",
      runs: [{ cardId: "c001", phase: "running" }],
    });
    expect(cardActivity(s, "c001", NOW)?.stale).toBe(true);
  });
});
