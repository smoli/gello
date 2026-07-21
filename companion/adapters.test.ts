import { describe, expect, it } from "vitest";
import {
  getAdapter,
  claudeAdapter,
  piAdapter,
  ADAPTER_NAMES,
  GELLO_TOOLS,
} from "./adapters.ts";

const SID = "11111111-2222-3333-4444-555555555555";

// c0104: a print run is piped and parsed, so claude asks for its structured
// stream. Interactive runs (the human drives a terminal) stay plain.
const STREAM = ["--output-format", "stream-json", "--verbose"];

describe("agent adapters — command construction", () => {
  const req = (mode: "print" | "interactive", resume = false) => ({
    sessionId: SID,
    prompt: "Work on card c0001",
    mode,
    resume,
  });

  it("claude: new session uses --session-id, -p and the stream flags in print mode", () => {
    expect(claudeAdapter.build(req("print"))).toEqual({
      command: "claude",
      args: ["--session-id", SID, "-p", ...STREAM, "Work on card c0001"],
    });
  });

  // The bug that surfaced in c0097: claude's --session-id *creates* a session
  // and errors ("already in use") if the id exists. Resuming must use --resume.
  it("claude: resuming an existing session uses --resume, not --session-id", () => {
    const spec = claudeAdapter.build(req("print", true));
    expect(spec).toEqual({
      command: "claude",
      args: ["--resume", SID, "-p", ...STREAM, "Work on card c0001"],
    });
    expect(spec.args).not.toContain("--session-id");
  });

  it("claude: interactive run omits -p and the stream flags (session persists)", () => {
    expect(claudeAdapter.build(req("interactive"))).toEqual({
      command: "claude",
      args: ["--session-id", SID, "Work on card c0001"],
    });
  });

  // pi's --session-id is idempotent ("creating it if missing"), so both a new
  // run and a resume use it — pi never errors on an existing id.
  it("pi: uses --session-id for both new and resumed sessions", () => {
    // pi has no structured stream, so no stream flags are added.
    expect(piAdapter.build(req("print")).args).toEqual([
      "--session-id",
      SID,
      "-p",
      "Work on card c0001",
    ]);
    expect(piAdapter.build(req("print", true)).args).toEqual([
      "--session-id",
      SID,
      "-p",
      "Work on card c0001",
    ]);
  });

  it("pi: interactive run omits -p", () => {
    expect(piAdapter.build(req("interactive")).args).not.toContain("-p");
  });

  // c0102 — the ask surface differs per backend: claude gets the MCP tool, pi
  // has no MCP at all and uses the `gello ask` CLI.
  describe("ask server wiring", () => {
    const askServer = {
      command: "tsx",
      args: ["/repo/companion/mcp-main.ts"],
      env: { GELLO_CARD_ID: "c001", GELLO_BOARD_ROOT: "/repo/.gello" },
    };
    const withServer = { ...req("print"), askServer };

    it("claude: configures the server inline and allows its tools", () => {
      const args = claudeAdapter.build(withServer).args;
      const config = JSON.parse(args[args.indexOf("--mcp-config") + 1]);
      expect(config).toEqual({ mcpServers: { gello: askServer } });
      // both agent-facing tools must be allowed (c0102 add_question, c0105 set_status)
      expect(args[args.indexOf("--allowed-tools") + 1]).toBe(GELLO_TOOLS.join(","));
    });

    it("claude: the prompt stays the last argv element", () => {
      const args = claudeAdapter.build(withServer).args;
      expect(args[args.length - 1]).toBe("Work on card c0001");
    });

    it("claude: omits the MCP flags when no server is supplied", () => {
      expect(claudeAdapter.build(req("print")).args).not.toContain("--mcp-config");
    });

    it("pi: ignores it — pi has no MCP", () => {
      expect(piAdapter.build(withServer).args).not.toContain("--mcp-config");
    });
  });

  // Headless runs can't answer an interactive approval prompt, so an
  // autonomous run passes claude a pre-approving --permission-mode (c0097).
  it("claude: passes --permission-mode when set, omits it for default/unset", () => {
    expect(claudeAdapter.build({ ...req("print"), permissionMode: "auto" }).args).toEqual(
      ["--session-id", SID, "--permission-mode", "auto", "-p", ...STREAM, "Work on card c0001"],
    );
    expect(claudeAdapter.build(req("print")).args).not.toContain("--permission-mode");
    expect(
      claudeAdapter.build({ ...req("print"), permissionMode: "default" }).args,
    ).not.toContain("--permission-mode");
  });

  it("pi: ignores permissionMode (no such flag)", () => {
    expect(
      piAdapter.build({ ...req("print"), permissionMode: "auto" }).args,
    ).not.toContain("--permission-mode");
  });

  it("passes the prompt as a single arg (never shell-joined)", () => {
    const spec = claudeAdapter.build({
      sessionId: "u",
      prompt: 'weird "quotes" and $vars; rm -rf',
      mode: "print",
      resume: false,
    });
    // the prompt is one argv element — safe to hand to spawn without a shell
    expect(spec.args[spec.args.length - 1]).toBe('weird "quotes" and $vars; rm -rf');
  });
});

// c0104 — each adapter owns the parser that maps ITS backend's output to the
// backend-neutral event stream. claude parses stream-json NDJSON; pi, which has
// no structured stream, degrades to prefixed plain text.
describe("stream parsing (adapter-owned)", () => {
  describe("claude: stream-json NDJSON", () => {
    const parse = (o: unknown) => claudeAdapter.stream.parse(JSON.stringify(o));

    it("maps an assistant text block to a text event", () => {
      const events = parse({
        type: "assistant",
        message: { content: [{ type: "text", text: "Looking at the code" }] },
      });
      expect(events).toEqual([{ kind: "text", text: "Looking at the code" }]);
    });

    // c0112: the TUI header names the model the run is actually using; it is on
    // the assistant event and was previously dropped.
    it("reports the model carried by an assistant event", () => {
      const events = parse({
        type: "assistant",
        message: {
          model: "claude-opus-4-8",
          content: [{ type: "text", text: "hi" }],
        },
      });
      expect(events).toContainEqual({ kind: "model", model: "claude-opus-4-8" });
    });

    it("reports the model even when the content is unusable", () => {
      // the header should still name the model if the blocks are not an array
      const events = parse({ type: "assistant", message: { model: "claude-haiku-4-5" } });
      expect(events).toEqual([{ kind: "model", model: "claude-haiku-4-5" }]);
    });

    it("reports no model when the assistant event carries none", () => {
      const events = parse({
        type: "assistant",
        message: { content: [{ type: "text", text: "hi" }] },
      });
      expect(events.some((e) => e.kind === "model")).toBe(false);
    });

    it("maps a tool_use block to a tool event with its primary argument", () => {
      const events = parse({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", name: "Bash", input: { command: "ls -la" } }],
        },
      });
      expect(events).toEqual([{ kind: "tool", name: "Bash", arg: "ls -la" }]);
    });

    it("picks a sensible primary argument per tool", () => {
      const read = parse({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", name: "Read", input: { file_path: "a.ts" } }],
        },
      });
      expect(read).toEqual([{ kind: "tool", name: "Read", arg: "a.ts" }]);
    });

    it("emits one event per content block, in order", () => {
      const events = parse({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "first" },
            { type: "tool_use", name: "Grep", input: { pattern: "foo" } },
          ],
        },
      });
      expect(events).toEqual([
        { kind: "text", text: "first" },
        { kind: "tool", name: "Grep", arg: "foo" },
      ]);
    });

    it("maps the final result to a usage event (tokens, cost, turns, denials)", () => {
      const events = claudeAdapter.stream.parse(
        JSON.stringify({
          type: "result",
          total_cost_usd: 0.0123,
          num_turns: 4,
          duration_ms: 9800,
          usage: {
            input_tokens: 120,
            output_tokens: 340,
            cache_read_input_tokens: 50,
            cache_creation_input_tokens: 10,
          },
          permission_denials: [{ tool_name: "Bash" }, { tool_name: "Write" }],
        }),
      );
      expect(events).toEqual([
        {
          kind: "usage",
          usage: {
            inputTokens: 120,
            outputTokens: 340,
            cacheReadTokens: 50,
            cacheCreationTokens: 10,
            totalCostUsd: 0.0123,
            numTurns: 4,
            durationMs: 9800,
            permissionDenials: 2,
          },
        },
      ]);
    });

    it("skips a system/user/rate-limit event (no neutral meaning)", () => {
      expect(parse({ type: "system", subtype: "init" })).toEqual([]);
      expect(parse({ type: "user", message: { content: [] } })).toEqual([]);
      expect(parse({ type: "rate_limit_event" })).toEqual([]);
    });

    it("skips a malformed or empty line, never throws", () => {
      expect(claudeAdapter.stream.parse("not json")).toEqual([]);
      expect(claudeAdapter.stream.parse("")).toEqual([]);
      expect(claudeAdapter.stream.parse("   ")).toEqual([]);
    });
  });

  describe("pi: plain text degradation", () => {
    it("maps each non-empty line to a text event, no tool/usage lines", () => {
      expect(piAdapter.stream.parse("thinking about it")).toEqual([
        { kind: "text", text: "thinking about it" },
      ]);
      expect(piAdapter.stream.parse("")).toEqual([]);
    });

    it("declares no stream flags (nothing structured to ask for)", () => {
      expect(piAdapter.stream.printArgs).toEqual([]);
    });
  });

  it("claude declares the stream flags it adds in print mode", () => {
    expect(claudeAdapter.stream.printArgs).toEqual(STREAM);
  });
});

describe("getAdapter", () => {
  it("resolves the known backends", () => {
    expect(getAdapter("claude")).toBe(claudeAdapter);
    expect(getAdapter("pi")).toBe(piAdapter);
    expect(ADAPTER_NAMES).toEqual(["claude", "pi"]);
  });

  it("throws a clear error for an unknown backend", () => {
    expect(() => getAdapter("gpt")).toThrow(/unknown agent backend "gpt"/);
  });
});
