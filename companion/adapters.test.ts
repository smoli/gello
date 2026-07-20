import { describe, expect, it } from "vitest";
import {
  getAdapter,
  claudeAdapter,
  piAdapter,
  ADAPTER_NAMES,
  ASK_TOOL,
} from "./adapters.ts";

const SID = "11111111-2222-3333-4444-555555555555";

describe("agent adapters — command construction", () => {
  const req = (mode: "print" | "interactive", resume = false) => ({
    sessionId: SID,
    prompt: "Work on card c0001",
    mode,
    resume,
  });

  it("claude: new session uses --session-id and -p in print mode", () => {
    expect(claudeAdapter.build(req("print"))).toEqual({
      command: "claude",
      args: ["--session-id", SID, "-p", "Work on card c0001"],
    });
  });

  // The bug that surfaced in c0097: claude's --session-id *creates* a session
  // and errors ("already in use") if the id exists. Resuming must use --resume.
  it("claude: resuming an existing session uses --resume, not --session-id", () => {
    const spec = claudeAdapter.build(req("print", true));
    expect(spec).toEqual({
      command: "claude",
      args: ["--resume", SID, "-p", "Work on card c0001"],
    });
    expect(spec.args).not.toContain("--session-id");
  });

  it("claude: interactive run omits -p (session persists)", () => {
    expect(claudeAdapter.build(req("interactive"))).toEqual({
      command: "claude",
      args: ["--session-id", SID, "Work on card c0001"],
    });
  });

  // pi's --session-id is idempotent ("creating it if missing"), so both a new
  // run and a resume use it — pi never errors on an existing id.
  it("pi: uses --session-id for both new and resumed sessions", () => {
    expect(piAdapter.build(req("print")).args).toEqual([
      "--session-id",
      SID,
      "-p",
      "Work on card c0001",
    ]);
    expect(piAdapter.build(req("print", true)).args).toEqual([
      "--session-id",
      SID,
      "-p",
      "Work on card c0001",
    ]);
  });

  it("pi: interactive run omits -p", () => {
    expect(piAdapter.build(req("interactive")).args).not.toContain("-p");
  });

  // c0102 — the ask surface differs per backend: claude gets the MCP tool, pi
  // has no MCP at all and uses the `gello ask` CLI.
  describe("ask server wiring", () => {
    const askServer = {
      command: "tsx",
      args: ["/repo/companion/mcp-main.ts"],
      env: { GELLO_CARD_ID: "c001", GELLO_BOARD_ROOT: "/repo/.gello" },
    };
    const withServer = { ...req("print"), askServer };

    it("claude: configures the server inline and allows its tool", () => {
      const args = claudeAdapter.build(withServer).args;
      const config = JSON.parse(args[args.indexOf("--mcp-config") + 1]);
      expect(config).toEqual({ mcpServers: { gello: askServer } });
      expect(args[args.indexOf("--allowed-tools") + 1]).toBe(ASK_TOOL);
    });

    it("claude: the prompt stays the last argv element", () => {
      const args = claudeAdapter.build(withServer).args;
      expect(args[args.length - 1]).toBe("Work on card c0001");
    });

    it("claude: omits the MCP flags when no server is supplied", () => {
      expect(claudeAdapter.build(req("print")).args).not.toContain("--mcp-config");
    });

    it("pi: ignores it — pi has no MCP", () => {
      expect(piAdapter.build(withServer).args).not.toContain("--mcp-config");
    });
  });

  // Headless runs can't answer an interactive approval prompt, so an
  // autonomous run passes claude a pre-approving --permission-mode (c0097).
  it("claude: passes --permission-mode when set, omits it for default/unset", () => {
    expect(claudeAdapter.build({ ...req("print"), permissionMode: "auto" }).args).toEqual(
      ["--session-id", SID, "--permission-mode", "auto", "-p", "Work on card c0001"],
    );
    expect(claudeAdapter.build(req("print")).args).not.toContain("--permission-mode");
    expect(
      claudeAdapter.build({ ...req("print"), permissionMode: "default" }).args,
    ).not.toContain("--permission-mode");
  });

  it("pi: ignores permissionMode (no such flag)", () => {
    expect(
      piAdapter.build({ ...req("print"), permissionMode: "auto" }).args,
    ).not.toContain("--permission-mode");
  });

  it("passes the prompt as a single arg (never shell-joined)", () => {
    const spec = claudeAdapter.build({
      sessionId: "u",
      prompt: 'weird "quotes" and $vars; rm -rf',
      mode: "print",
      resume: false,
    });
    // the prompt is one argv element — safe to hand to spawn without a shell
    expect(spec.args[spec.args.length - 1]).toBe('weird "quotes" and $vars; rm -rf');
  });
});

describe("getAdapter", () => {
  it("resolves the known backends", () => {
    expect(getAdapter("claude")).toBe(claudeAdapter);
    expect(getAdapter("pi")).toBe(piAdapter);
    expect(ADAPTER_NAMES).toEqual(["claude", "pi"]);
  });

  it("throws a clear error for an unknown backend", () => {
    expect(() => getAdapter("gpt")).toThrow(/unknown agent backend "gpt"/);
  });
});
