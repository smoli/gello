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
}

export interface AgentAdapter {
  readonly name: string;
  build(req: RunRequest): LaunchSpec;
}

/** Builds `<cmd> <headArgs> [-p] <prompt>`, where a backend decides its
 *  session + permission flags. The prompt is always a single argv element, so
 *  it is safe to hand to `spawn` with no shell. */
function buildWith(
  command: string,
  headArgs: (req: RunRequest) => string[],
): AgentAdapter["build"] {
  return (req) => {
    const args = [...headArgs(req)];
    if (req.mode === "print") args.push("-p"); // non-interactive; interactive omits it
    args.push(req.prompt);
    return { command, args };
  };
}

export const claudeAdapter: AgentAdapter = {
  name: "claude",
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
    return args;
  }),
};

export const piAdapter: AgentAdapter = {
  name: "pi",
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
