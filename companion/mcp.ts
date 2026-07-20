// The Claude side of the companion's dual-surface design (pi has no MCP and
// uses the `gello ask` CLI instead). Two tools over the run-scoped card:
//   - `add_question` (c0102) — park a question and wait for the human.
//   - `set_status` (c0105) — move the card between statuses.
//
// Neither takes a card argument: the card is fixed at server construction from
// the run the companion started (`GELLO_CARD_ID`), so an agent cannot write to
// an unrelated card. Transport is the caller's (stdio for a spawned run).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { askQuestion } from "./ask.ts";
import { setCardStatus } from "./set-status.ts";

const ASK_TOOL = {
  name: "add_question",
  description:
    "Ask the human a question about the card you are working on. The question " +
    "is written onto the card and the human answers it there. Write the " +
    "question as markdown; for a multiple-choice question, list the options as " +
    "`- [ ] option` checkbox lines. After calling this, exit — you are resumed " +
    "automatically once the human has answered.",
  inputSchema: {
    type: "object" as const,
    properties: {
      markdown: {
        type: "string",
        description: "The question as markdown, with `- [ ] option` lines for a choice.",
      },
    },
    required: ["markdown"],
  },
};

const SET_STATUS_TOOL = {
  name: "set_status",
  description:
    "Move the card you are working on to a new status (board column). Call this " +
    "with `in-progress` the moment you start, before any analysis, so the human " +
    "sees you have picked the card up; call it with `review` when the acceptance " +
    "criteria pass. It stamps the change and adds a Log line for you.",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        description: "The target status, e.g. `in-progress` or `review`.",
      },
    },
    required: ["status"],
  },
};

/** An MCP server exposing the companion's agent-facing tools, locked to one
 *  board and one card. */
export function createGelloServer(root: string, cardId: string): Server {
  const server = new Server(
    { name: "gello", version: "1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [ASK_TOOL, SET_STATUS_TOOL],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    // A refusal (question already open, unknown card/status, bad argument) is
    // the agent's problem to read and act on, not a transport failure — every
    // handler reports it as a tool error rather than throwing.
    switch (req.params.name) {
      case ASK_TOOL.name:
        return handleAddQuestion(root, cardId, req.params.arguments);
      case SET_STATUS_TOOL.name:
        return handleSetStatus(root, cardId, req.params.arguments);
      default:
        return errorResult(`unknown tool: ${req.params.name}`);
    }
  });

  return server;
}

function handleAddQuestion(
  root: string,
  cardId: string,
  args: Record<string, unknown> | undefined,
) {
  const markdown = args?.markdown;
  if (typeof markdown !== "string") {
    return errorResult("markdown must be a string");
  }
  try {
    askQuestion(root, cardId, markdown);
  } catch (error) {
    return errorResult((error as Error).message);
  }
  return textResult(
    `Question parked on ${cardId}. Exit now — you will be resumed once the ` +
      `human has answered it on the card.`,
  );
}

function handleSetStatus(
  root: string,
  cardId: string,
  args: Record<string, unknown> | undefined,
) {
  const status = args?.status;
  if (typeof status !== "string") {
    return errorResult("status must be a string");
  }
  try {
    setCardStatus(root, cardId, status);
  } catch (error) {
    return errorResult((error as Error).message);
  }
  return textResult(`Moved ${cardId} to ${status}.`);
}

function textResult(text: string) {
  return { content: [{ type: "text", text }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text", text: message }] };
}
