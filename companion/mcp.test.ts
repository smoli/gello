import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAskServer } from "./mcp.ts";

const CARD = (id: string) =>
  `---\nid: ${id}\ntitle: Work\nstatus: in-progress\nupdated: 2026-07-01\n---\n\n## What\n\ntask\n`;

let root: string;

/** A client wired to the ask server over an in-memory transport pair. */
async function connect(cardId = "c001"): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([
    createAskServer(root, cardId).connect(serverSide),
    client.connect(clientSide),
  ]);
  return client;
}

const read = (rel: string) => readFileSync(join(root, rel), "utf8");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gello-mcp-"));
  mkdirSync(join(root, "cards"), { recursive: true });
  writeFileSync(join(root, "board.yaml"), "columns: [ready, in-progress, review]\n");
  writeFileSync(join(root, "cards/c001-work.md"), CARD("c001"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("add_question MCP server (c0102)", () => {
  it("advertises add_question with a markdown-only input", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name)).toEqual(["add_question"]);
    // markdown-only: the card comes from the run, not from the agent
    expect(Object.keys(tools[0].inputSchema.properties ?? {})).toEqual(["markdown"]);
    expect(tools[0].inputSchema.required).toEqual(["markdown"]);
  });

  it("parks the question on the run's card", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "add_question",
      arguments: { markdown: "Which db?\n\n- [ ] Postgres\n- [ ] SQLite" },
    });

    expect(result.isError).toBeFalsy();
    const written = read("cards/c001-work.md");
    expect(written).toContain("```gelloquestion\nWhich db?");
    expect(written).toContain("awaiting: input");
  });

  it("tells the agent to exit and wait, so it does not keep working", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "add_question",
      arguments: { markdown: "Which db?" },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/exit/i);
  });

  it("reports a refusal as a tool error, not a crash", async () => {
    const client = await connect();
    await client.callTool({ name: "add_question", arguments: { markdown: "First?" } });
    const result = await client.callTool({
      name: "add_question",
      arguments: { markdown: "Second?" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/already/i);
    expect(read("cards/c001-work.md")).not.toContain("Second?");
  });

  it("errors when the run's card does not exist", async () => {
    const client = await connect("c999");
    const result = await client.callTool({
      name: "add_question",
      arguments: { markdown: "Which db?" },
    });
    expect(result.isError).toBe(true);
  });
});
