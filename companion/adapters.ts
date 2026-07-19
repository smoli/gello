// gello-companion agent adapters (c0094): a thin abstraction over an agent
// CLI backend. The rest of the companion talks to agents only through this.
//
// Key simplification (verified against `claude --help` / `pi --help`): both
// CLIs accept a *caller-provided* session id that they create if missing and
// resume if it exists — `claude --session-id <uuid>`, `pi --session-id <id>`.
// So the companion **owns** the UUID (see sessions.ts) and passes it on every
// run; there is no session id to parse back out of the output.

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
  /** Caller-owned session id (created if new, resumed if it exists). */
  sessionId: string;
  /** The task/prompt for this turn. */
  prompt: string;
  mode: RunMode;
}

export interface AgentAdapter {
  readonly name: string;
  build(req: RunRequest): LaunchSpec;
}

/** `<cmd> --session-id <uuid> [-p] <prompt>` — the shape both CLIs share. */
function buildWith(command: string): AgentAdapter["build"] {
  return ({ sessionId, prompt, mode }) => {
    const args = ["--session-id", sessionId];
    if (mode === "print") args.push("-p"); // non-interactive; interactive omits it
    args.push(prompt); // single argv element — never shell-joined
    return { command, args };
  };
}

export const claudeAdapter: AgentAdapter = { name: "claude", build: buildWith("claude") };
export const piAdapter: AgentAdapter = { name: "pi", build: buildWith("pi") };

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
