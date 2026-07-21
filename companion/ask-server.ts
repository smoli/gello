// i0118: how the agent launches the gello MCP stdio server (`add_question`,
// `set_status`).
//
// c0102 pointed the agent at a sibling `mcp-main.ts`. That only works in a dev
// checkout: the shipped companion is a single bundled `.mjs` with no `.ts` files
// beside it. So the server is a **subcommand of the running entry** — whatever
// file is executing re-invokes itself with `mcp`. One contract covers both the
// dev entry (tsx loading `main.ts`) and the bundled entry (node loading the
// `.mjs`), because each knows its own path.

import type { AskServerSpec } from "./adapters.ts";
import { findBoardRoot } from "./core.ts";

/** The subcommand that turns an entry into the MCP stdio server. */
export const MCP_SUBCOMMAND = "mcp";

/**
 * Build the spec that launches the MCP server as a stdio child of the agent.
 *
 * `execArgv` is the runtime's own argv (in dev, the tsx loader flags) and must
 * come first — without it the child would run the TypeScript entry as plain JS.
 * The runner adds the run's card id to `env`, which is what scopes the tools.
 */
export function askServerSpec(
  entry: string,
  execPath: string,
  execArgv: readonly string[],
  root: string,
): AskServerSpec {
  return {
    command: execPath,
    args: [...execArgv, entry, MCP_SUBCOMMAND],
    env: { GELLO_BOARD_ROOT: root },
  };
}

/** What the MCP server is scoped to: the run's card and its board. */
export interface McpScope {
  cardId: string;
  root: string;
}

/**
 * Resolve the scope the MCP server serves, from the environment the companion
 * stamped on the child. Throws with a usable message rather than exiting, so
 * the caller owns the exit code. The card id is mandatory — it is what stops an
 * agent writing to an unrelated card.
 */
export function resolveMcpScope(env: NodeJS.ProcessEnv, cwd: string): McpScope {
  const cardId = env.GELLO_CARD_ID;
  if (!cardId) {
    throw new Error("GELLO_CARD_ID is not set — the server needs a card to scope to");
  }
  const root = env.GELLO_BOARD_ROOT ?? findBoardRoot(cwd);
  if (!root) throw new Error(`no .gello board found from ${cwd}`);
  return { cardId, root };
}
