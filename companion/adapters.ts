// gello-companion agent adapters (c0094): a thin abstraction over an agent
// CLI backend. The rest of the companion talks to agents only through this.
//
// The companion **owns** the session UUID (see sessions.ts) and passes it on
// every run; there is no session id to parse back out of the output. But
// starting a new session and resuming an existing one are not the same flag,
// and the two CLIs differ (c0097 hit "session id already in use"):
//   - claude: `--session-id <uuid>` *creates* (errors if the id exists);
//     resume with `--resume <uuid>`.
//   - pi: `--session-id <id>` is idempotent ("creating it if missing"), so it
//     serves both new and resumed runs.
// The adapter takes `resume` and builds the right invocation per backend.

import type { AgentEvent, RunUsage } from "./stream.ts";

/** How a run is launched: headless (capture output) or interactive (a
 *  terminal the human can drive — the c0098 fallback). */
export type RunMode = "print" | "interactive";

/** A ready-to-spawn invocation. `args` are argv elements — pass straight to
 *  `spawn(command, args)` with no shell, so a prompt never needs escaping. */
export interface LaunchSpec {
  command: string;
  args: string[];
}

export interface RunRequest {
  /** Caller-owned session id. */
  sessionId: string;
  /** The task/prompt for this turn. */
  prompt: string;
  mode: RunMode;
  /** Resume an existing session rather than create a new one. */
  resume: boolean;
  /** Permission posture for a headless run. A `-p` agent cannot answer an
   *  interactive approval prompt, so autonomous writes/commands need a mode
   *  that pre-approves them (claude: `auto`; `default` prompts and thus fails
   *  headless). Backends without such a flag (pi) ignore it. */
  permissionMode?: string;
  /** c0102/c0105: an MCP stdio server to wire into the run (the `add_question`
   *  and `set_status` tools). Backends without MCP (pi) ignore it and use the
   *  `gello ask` CLI instead. */
  askServer?: AskServerSpec;
}

/** How to launch the ask MCP server as a stdio child of the agent. */
export interface AskServerSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** The tool names the agent must be allowed to call, per MCP's
 *  `mcp__<server>__<tool>` (c0102 add_question, c0105 set_status). */
export const ASK_TOOL = "mcp__gello__add_question";
export const SET_STATUS_TOOL = "mcp__gello__set_status";
export const GELLO_TOOLS = [ASK_TOOL, SET_STATUS_TOOL];

/** c0104: an adapter's stream capability. A print run is piped and parsed for
 *  observability, so the adapter both asks its backend for the right output
 *  (`printArgs`, added only in print mode) and supplies the parser that maps
 *  that output to the backend-neutral event stream. A backend with no
 *  structured stream (pi) declares no flags and parses plain text. */
export interface StreamAdapter {
  /** Extra argv for structured streaming, added in print mode only. */
  readonly printArgs: string[];
  /** Map one line of the backend's stdout to zero or more neutral events. Must
   *  never throw — a malformed line yields `[]` so bad output can't kill a run. */
  parse(line: string): AgentEvent[];
}

export interface AgentAdapter {
  readonly name: string;
  build(req: RunRequest): LaunchSpec;
  readonly stream: StreamAdapter;
}

/** Builds `<cmd> <headArgs> [-p <streamArgs>] <prompt>`, where a backend
 *  decides its session + permission flags. The stream flags are added only in
 *  print mode (the piped, parsed path). The prompt is always a single argv
 *  element, so it is safe to hand to `spawn` with no shell. */
function buildWith(
  command: string,
  headArgs: (req: RunRequest) => string[],
  printArgs: string[] = [],
): AgentAdapter["build"] {
  return (req) => {
    const args = [...headArgs(req)];
    if (req.mode === "print") args.push("-p", ...printArgs); // interactive omits both
    args.push(req.prompt);
    return { command, args };
  };
}

// --- stream parsing ---------------------------------------------------------
//
// JSON.parse of a backend's NDJSON is an untyped boundary — the shapes below are
// external. We narrow with small typed accessors rather than reaching for `any`.

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/** The claude stream flags: `--print` already; ask for the structured stream.
 *  `--verbose` is required by the CLI when `--print` is combined with
 *  `--output-format stream-json`. */
const CLAUDE_STREAM_ARGS = ["--output-format", "stream-json", "--verbose"];

/** A tool call's most informative argument, tried in priority order and then
 *  falling back to the first string value — enough to label the call. */
const PRIMARY_KEYS = [
  "command",
  "file_path",
  "path",
  "pattern",
  "query",
  "url",
  "description",
  "prompt",
];

function primaryArg(input: unknown): string | undefined {
  const rec = asRecord(input);
  if (!rec) return undefined;
  for (const key of PRIMARY_KEYS) {
    if (typeof rec[key] === "string") return rec[key] as string;
  }
  for (const value of Object.values(rec)) {
    if (typeof value === "string") return value;
  }
  return undefined;
}

function claudeUsage(obj: Record<string, unknown>): RunUsage {
  const u = asRecord(obj.usage) ?? {};
  const usage: RunUsage = {
    inputTokens: num(u.input_tokens),
    outputTokens: num(u.output_tokens),
  };
  if (u.cache_read_input_tokens != null) usage.cacheReadTokens = num(u.cache_read_input_tokens);
  if (u.cache_creation_input_tokens != null) {
    usage.cacheCreationTokens = num(u.cache_creation_input_tokens);
  }
  if (typeof obj.total_cost_usd === "number") usage.totalCostUsd = obj.total_cost_usd;
  if (typeof obj.num_turns === "number") usage.numTurns = obj.num_turns;
  if (typeof obj.duration_ms === "number") usage.durationMs = obj.duration_ms;
  if (Array.isArray(obj.permission_denials)) {
    usage.permissionDenials = obj.permission_denials.length;
  }
  return usage;
}

/** Parse one line of claude's `stream-json` NDJSON. `assistant` messages carry
 *  content blocks (`text`, `tool_use`); the final `result` carries usage. Any
 *  other event (`system`, `user`, `rate_limit_event`) has no neutral meaning
 *  and a malformed line is skipped — never fatal. */
function claudeParse(line: string): AgentEvent[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  const obj = asRecord(parsed);
  if (!obj) return [];
  if (obj.type === "assistant") {
    const message = asRecord(obj.message);
    const content = message?.content ?? obj.content;
    if (!Array.isArray(content)) return [];
    const events: AgentEvent[] = [];
    for (const raw of content) {
      const block = asRecord(raw);
      if (!block) continue;
      if (block.type === "text" && typeof block.text === "string") {
        events.push({ kind: "text", text: block.text });
      } else if (block.type === "tool_use" && typeof block.name === "string") {
        events.push({ kind: "tool", name: block.name, arg: primaryArg(block.input) });
      }
    }
    return events;
  }
  if (obj.type === "result") {
    return [{ kind: "usage", usage: claudeUsage(obj) }];
  }
  return [];
}

/** pi has no structured stream, so every non-empty line is opaque assistant
 *  text; there are no tool or usage events to recover. */
function piParse(line: string): AgentEvent[] {
  return line.trim() === "" ? [] : [{ kind: "text", text: line }];
}

export const claudeAdapter: AgentAdapter = {
  name: "claude",
  stream: { printArgs: CLAUDE_STREAM_ARGS, parse: claudeParse },
  build: buildWith("claude", (req) => {
    // --session-id creates (errors if it exists); --resume continues one.
    const args = req.resume
      ? ["--resume", req.sessionId]
      : ["--session-id", req.sessionId];
    // `default` is the CLI's own default (interactive prompts) — omit it so a
    // headless run gets an explicit auto-approving mode when asked.
    if (req.permissionMode && req.permissionMode !== "default") {
      args.push("--permission-mode", req.permissionMode);
    }
    // c0102: the ask server is scoped to this run — configured inline rather
    // than in the user's ~/.claude config, so it exists only for this process
    // and carries this card's id.
    if (req.askServer) {
      const { command, args: serverArgs, env } = req.askServer;
      args.push(
        "--mcp-config",
        JSON.stringify({
          mcpServers: { gello: { command, args: serverArgs, env } },
        }),
        "--allowed-tools",
        GELLO_TOOLS.join(","),
      );
    }
    return args;
  }, CLAUDE_STREAM_ARGS),
};

export const piAdapter: AgentAdapter = {
  name: "pi",
  // No structured stream: no flags to add, and the parser sees plain text.
  stream: { printArgs: [], parse: piParse },
  // --session-id is create-or-use, so it covers both cases. pi's `-p` runs
  // tools without an interactive gate, so there is no permission flag to pass.
  build: buildWith("pi", (req) => ["--session-id", req.sessionId]),
};

const ADAPTERS: Record<string, AgentAdapter> = {
  claude: claudeAdapter,
  pi: piAdapter,
};

export const ADAPTER_NAMES = Object.keys(ADAPTERS);

export function getAdapter(name: string): AgentAdapter {
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(
      `unknown agent backend "${name}" (have: ${ADAPTER_NAMES.join(", ")})`,
    );
  }
  return adapter;
}
