// c0102/c0105: stdio entrypoint for the gello MCP server (`add_question`,
// `set_status`). The agent CLI spawns this as a child of the run; the companion
// supplies the board root and the run's card id through the environment (see
// adapters.ts / runner.ts).
//
// stdout is the JSON-RPC channel — never write to it. Diagnostics go to stderr.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGelloServer } from "./mcp.ts";
import { findBoardRoot } from "./core.ts";

async function main(): Promise<void> {
  const cardId = process.env.GELLO_CARD_ID;
  if (!cardId) {
    console.error("GELLO_CARD_ID is not set — the server needs a card to scope to");
    process.exit(1);
  }
  const root = process.env.GELLO_BOARD_ROOT ?? findBoardRoot(process.cwd());
  if (!root) {
    console.error(`no .gello board found from ${process.cwd()}`);
    process.exit(1);
  }
  await createGelloServer(root, cardId).connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error(`gello mcp server failed: ${(error as Error).message}`);
  process.exit(1);
});
