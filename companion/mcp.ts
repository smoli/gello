// c0102: the MCP surface for parking a question — the Claude side of the
// dual-surface design (pi has no MCP and uses `gello ask` instead). One tool,
// `add_question`, over the same askQuestion() core.
//
// The tool takes only markdown: the card is fixed at server construction from
// the run the companion started, so an agent cannot park a question on an
// unrelated card. Transport is the caller's (stdio for a spawned run).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { askQuestion } from "./ask.ts";

const TOOL = {
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

/** An MCP server exposing `add_question`, locked to one board and one card. */
export function createAskServer(root: string, cardId: string): Server {
  const server = new Server(
    { name: "gello", version: "1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [TOOL] }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== TOOL.name) {
      return errorResult(`unknown tool: ${req.params.name}`);
    }
    const markdown = req.params.arguments?.markdown;
    if (typeof markdown !== "string") {
      return errorResult("markdown must be a string");
    }
    try {
      askQuestion(root, cardId, markdown);
    } catch (error) {
      // A refusal (question already open, unknown card) is the agent's problem
      // to read and act on, not a transport failure — report it as a tool error.
      return errorResult((error as Error).message);
    }
    return {
      content: [
        {
          type: "text",
          text:
            `Question parked on ${cardId}. Exit now — you will be resumed once ` +
            `the human has answered it on the card.`,
        },
      ],
    };
  });

  return server;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text", text: message }] };
}
