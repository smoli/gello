import { describe, expect, it } from "vitest";
import { getAdapter, claudeAdapter, piAdapter, ADAPTER_NAMES } from "./adapters.ts";

describe("agent adapters — command construction", () => {
  const req = (mode: "print" | "interactive") => ({
    sessionId: "11111111-2222-3333-4444-555555555555",
    prompt: "Work on card c0001",
    mode,
  });

  it("claude: print run passes the caller-owned session id and -p", () => {
    expect(claudeAdapter.build(req("print"))).toEqual({
      command: "claude",
      args: [
        "--session-id",
        "11111111-2222-3333-4444-555555555555",
        "-p",
        "Work on card c0001",
      ],
    });
  });

  it("claude: interactive run omits -p (session persists)", () => {
    expect(claudeAdapter.build(req("interactive"))).toEqual({
      command: "claude",
      args: [
        "--session-id",
        "11111111-2222-3333-4444-555555555555",
        "Work on card c0001",
      ],
    });
  });

  it("pi: print run uses --session-id and -p", () => {
    expect(piAdapter.build(req("print"))).toEqual({
      command: "pi",
      args: [
        "--session-id",
        "11111111-2222-3333-4444-555555555555",
        "-p",
        "Work on card c0001",
      ],
    });
  });

  it("pi: interactive run omits -p", () => {
    expect(piAdapter.build(req("interactive")).args).not.toContain("-p");
  });

  it("passes the prompt as a single arg (never shell-joined)", () => {
    const spec = claudeAdapter.build({
      sessionId: "u",
      prompt: 'weird "quotes" and $vars; rm -rf',
      mode: "print",
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
