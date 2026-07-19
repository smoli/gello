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
}

export interface AgentAdapter {
  readonly name: string;
  build(req: RunRequest): LaunchSpec;
}

/** Builds `<cmd> <sessionArgs> [-p] <prompt>`, where a backend decides how to
 *  name a new vs. resumed session. The prompt is always a single argv element,
 *  so it is safe to hand to `spawn` with no shell. */
function buildWith(
  command: string,
  sessionArgs: (sessionId: string, resume: boolean) => string[],
): AgentAdapter["build"] {
  return ({ sessionId, prompt, mode, resume }) => {
    const args = [...sessionArgs(sessionId, resume)];
    if (mode === "print") args.push("-p"); // non-interactive; interactive omits it
    args.push(prompt);
    return { command, args };
  };
}

export const claudeAdapter: AgentAdapter = {
  name: "claude",
  // --session-id creates (errors if it exists); --resume continues one.
  build: buildWith("claude", (id, resume) =>
    resume ? ["--resume", id] : ["--session-id", id],
  ),
};

export const piAdapter: AgentAdapter = {
  name: "pi",
  // --session-id is create-or-use, so it covers both cases.
  build: buildWith("pi", (id) => ["--session-id", id]),
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
