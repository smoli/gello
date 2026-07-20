import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createGelloServer } from "./mcp.ts";

const CARD = (id: string) =>
  `---\nid: ${id}\ntitle: Work\nstatus: ready\nupdated: 2026-07-01\n---\n\n## What\n\ntask\n`;

let root: string;

/** A client wired to the gello server over an in-memory transport pair. */
async function connect(cardId = "c001"): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([
    createGelloServer(root, cardId).connect(serverSide),
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

    const addQuestion = tools.find((t) => t.name === "add_question");
    expect(addQuestion).toBeDefined();
    // markdown-only: the card comes from the run, not from the agent
    expect(Object.keys(addQuestion!.inputSchema.properties ?? {})).toEqual(["markdown"]);
    expect(addQuestion!.inputSchema.required).toEqual(["markdown"]);
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

describe("set_status MCP tool (c0105)", () => {
  it("advertises set_status with a status-only input", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    const setStatus = tools.find((t) => t.name === "set_status");
    expect(setStatus).toBeDefined();
    // status-only: the card comes from the run, not from the agent
    expect(Object.keys(setStatus!.inputSchema.properties ?? {})).toEqual(["status"]);
    expect(setStatus!.inputSchema.required).toEqual(["status"]);
  });

  it("moves the run's card to the new status", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "set_status",
      arguments: { status: "in-progress" },
    });

    expect(result.isError).toBeFalsy();
    const written = read("cards/c001-work.md");
    expect(written).toContain("status: in-progress");
    expect(written).toMatch(/status-changed: \d{4}-\d{2}-\d{2}T/);
  });

  it("reports an unknown status as a tool error, not a crash", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "set_status",
      arguments: { status: "nonsense" },
    });

    expect(result.isError).toBe(true);
    expect(read("cards/c001-work.md")).toContain("status: ready");
  });

  it("errors when the run's card does not exist", async () => {
    const client = await connect("c999");
    const result = await client.callTool({
      name: "set_status",
      arguments: { status: "in-progress" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects a non-string status", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "set_status",
      arguments: { status: 3 as unknown as string },
    });
    expect(result.isError).toBe(true);
  });
});
