import { describe, expect, it } from "vitest";
import {
  LineBuffer,
  renderEvent,
  formatUsage,
  StreamSink,
  type AgentEvent,
  type RunUsage,
} from "./stream.ts";

// --- LineBuffer -------------------------------------------------------------

describe("LineBuffer", () => {
  it("splits complete lines and holds a partial one", () => {
    const buf = new LineBuffer();
    expect(buf.push("a\nb")).toEqual(["a"]); // "b" is incomplete
    expect(buf.push("c\n")).toEqual(["bc"]); // completed on the next chunk
  });

  it("returns every complete line in one chunk", () => {
    const buf = new LineBuffer();
    expect(buf.push("one\ntwo\nthree\n")).toEqual(["one", "two", "three"]);
  });

  it("flush yields the trailing partial line, once", () => {
    const buf = new LineBuffer();
    buf.push("tail");
    expect(buf.flush()).toBe("tail");
    expect(buf.flush()).toBe(""); // already drained
  });

  it("tolerates CRLF line endings", () => {
    const buf = new LineBuffer();
    expect(buf.push("a\r\nb\r\n")).toEqual(["a", "b"]);
  });
});

// --- renderEvent ------------------------------------------------------------

const tool: AgentEvent = { kind: "tool", name: "Bash", arg: "ls -la" };
const text: AgentEvent = { kind: "text", text: "hello\nworld" };
const usage: AgentEvent = {
  kind: "usage",
  usage: {
    inputTokens: 100,
    outputTokens: 200,
    totalCostUsd: 0.0123,
    numTurns: 5,
    durationMs: 12300,
    permissionDenials: 2,
  },
};

describe("renderEvent", () => {
  it("quiet renders nothing from the stream", () => {
    expect(renderEvent("quiet", "c001", tool)).toEqual([]);
    expect(renderEvent("quiet", "c001", text)).toEqual([]);
    expect(renderEvent("quiet", "c001", usage)).toEqual([]);
  });

  it("normal renders tool calls and the usage summary, not assistant text", () => {
    expect(renderEvent("normal", "c001", tool)).toEqual(["[c001] → Bash(ls -la)"]);
    expect(renderEvent("normal", "c001", text)).toEqual([]);
    expect(renderEvent("normal", "c001", usage)).toHaveLength(1);
  });

  it("verbose additionally renders assistant text, one prefixed line each", () => {
    expect(renderEvent("verbose", "c001", text)).toEqual([
      "[c001] hello",
      "[c001] world",
    ]);
    expect(renderEvent("verbose", "c001", tool)).toEqual(["[c001] → Bash(ls -la)"]);
  });

  it("every rendered line carries the card id (concurrent runs stay readable)", () => {
    const lines = [
      ...renderEvent("verbose", "c042", tool),
      ...renderEvent("verbose", "c042", text),
      ...renderEvent("verbose", "c042", usage),
    ];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.startsWith("[c042] ")).toBe(true);
  });

  it("renders a tool call with no argument without empty parens", () => {
    expect(renderEvent("normal", "c001", { kind: "tool", name: "TodoWrite" })).toEqual([
      "[c001] → TodoWrite",
    ]);
  });

  it("collapses a multi-line tool argument to a single readable line", () => {
    const line = renderEvent("normal", "c001", {
      kind: "tool",
      name: "Bash",
      arg: "cd foo\nrm bar",
    })[0];
    expect(line).not.toContain("\n");
    expect(line).toContain("cd foo");
  });

  it("truncates a very long tool argument", () => {
    const line = renderEvent("normal", "c001", {
      kind: "tool",
      name: "Bash",
      arg: "x".repeat(500),
    })[0];
    expect(line.length).toBeLessThan(200);
    expect(line).toContain("…");
  });
});

describe("formatUsage", () => {
  it("summarizes tokens, cost, turns and duration", () => {
    const line = formatUsage(usage.kind === "usage" ? usage.usage : ({} as RunUsage));
    expect(line).toContain("100");
    expect(line).toContain("200");
    expect(line).toContain("$0.0123");
    expect(line).toContain("5 turns");
    expect(line).toContain("12.3s");
  });

  it("surfaces permission denials (the c0097 headless bug would have shown)", () => {
    const line = formatUsage({
      inputTokens: 1,
      outputTokens: 1,
      permissionDenials: 3,
    });
    expect(line).toMatch(/3 .*denial/);
  });

  it("omits denials when there are none", () => {
    const line = formatUsage({ inputTokens: 1, outputTokens: 1, permissionDenials: 0 });
    expect(line).not.toMatch(/denial/);
  });
});

// --- StreamSink -------------------------------------------------------------

/** A parser that treats each line as a JSON AgentEvent (test double). */
function jsonParse(line: string): AgentEvent[] {
  const t = line.trim();
  if (!t) return [];
  try {
    return [JSON.parse(t) as AgentEvent];
  } catch {
    return []; // malformed → skipped, never fatal
  }
}

function makeSink(level: "quiet" | "normal" | "verbose") {
  const emitted: string[] = [];
  const logged: { cardId: string; event: AgentEvent }[] = [];
  const sink = new StreamSink(
    "c001",
    level,
    jsonParse,
    (line) => emitted.push(line),
    (cardId, event) => logged.push({ cardId, event }),
  );
  return { sink, emitted, logged };
}

describe("StreamSink", () => {
  it("parses piped chunks across line boundaries and renders per level", () => {
    const { sink, emitted } = makeSink("normal");
    sink.feed('{"kind":"tool","name":"Read","arg":"a.ts"}\n{"kind":"tool"');
    sink.feed(',"name":"Bash","arg":"ls"}\n');
    expect(emitted).toEqual(["[c001] → Read(a.ts)", "[c001] → Bash(ls)"]);
  });

  it("captures the last usage event so the run can report tokens/cost", () => {
    const { sink } = makeSink("normal");
    sink.feed(
      '{"kind":"usage","usage":{"inputTokens":10,"outputTokens":20,"totalCostUsd":0.5}}\n',
    );
    expect(sink.usage()).toEqual({ inputTokens: 10, outputTokens: 20, totalCostUsd: 0.5 });
  });

  it("logs every event regardless of level (runs.log is the full transcript)", () => {
    const { sink, emitted, logged } = makeSink("quiet");
    sink.feed('{"kind":"text","text":"thinking"}\n{"kind":"tool","name":"Bash"}\n');
    expect(emitted).toEqual([]); // quiet shows nothing on the terminal
    expect(logged.map((l) => l.event.kind)).toEqual(["text", "tool"]); // but all logged
  });

  it("a malformed line is skipped, never fatal", () => {
    const { sink, emitted } = makeSink("normal");
    expect(() =>
      sink.feed('not json\n{"kind":"tool","name":"Bash","arg":"ls"}\n'),
    ).not.toThrow();
    expect(emitted).toEqual(["[c001] → Bash(ls)"]);
  });

  it("flushes a trailing unterminated line on end()", () => {
    const { sink, emitted } = makeSink("normal");
    sink.feed('{"kind":"tool","name":"Bash","arg":"ls"}'); // no trailing newline
    expect(emitted).toEqual([]);
    sink.end();
    expect(emitted).toEqual(["[c001] → Bash(ls)"]);
  });
});
