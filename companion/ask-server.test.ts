import { describe, expect, it } from "vitest";
import { MCP_SUBCOMMAND, askServerSpec, resolveMcpScope } from "./ask-server.ts";

// i0118: the companion ships as a single bundled .mjs, so the MCP stdio server
// can no longer be a separate `mcp-main.ts` path — it is a subcommand of
// whatever entry is currently running. These pin that contract for both the dev
// entry (tsx loading main.ts) and the bundled entry (node loading the .mjs).

const ROOT = "/proj/.gello";

describe("askServerSpec", () => {
  it("re-invokes the *current* entry with the mcp subcommand", () => {
    const spec = askServerSpec("/app/gello-companion.mjs", "/usr/bin/node", [], ROOT);
    expect(spec.command).toBe("/usr/bin/node");
    expect(spec.args).toEqual(["/app/gello-companion.mjs", MCP_SUBCOMMAND]);
  });

  it("keeps the runtime's own argv in front (dev: the tsx loader flags)", () => {
    // Without these the child would run main.ts as plain JS and die on the types.
    const execArgv = ["--require", "/n/tsx/preflight.cjs", "--import", "file:///n/tsx/loader.mjs"];
    const spec = askServerSpec("/repo/companion/main.ts", "/usr/bin/node", execArgv, ROOT);
    expect(spec.args).toEqual([...execArgv, "/repo/companion/main.ts", MCP_SUBCOMMAND]);
  });

  it("scopes the server to the board root through the environment", () => {
    const spec = askServerSpec("/app/x.mjs", "/usr/bin/node", [], ROOT);
    expect(spec.env).toEqual({ GELLO_BOARD_ROOT: ROOT });
  });

  it("names no .ts file — a shipped bundle has none", () => {
    const spec = askServerSpec("/app/gello-companion.mjs", "/usr/bin/node", [], ROOT);
    expect(spec.args.some((a) => a.endsWith(".ts"))).toBe(false);
  });
});

// The scope the MCP server runs under, lifted out of the old mcp-main.ts entry
// so the `mcp` subcommand and its validation are testable.
describe("resolveMcpScope", () => {
  it("takes the card and board root from the environment", () => {
    const scope = resolveMcpScope({ GELLO_CARD_ID: "c001", GELLO_BOARD_ROOT: ROOT }, "/anywhere");
    expect(scope).toEqual({ cardId: "c001", root: ROOT });
  });

  it("fails clearly when no card scopes the run", () => {
    expect(() => resolveMcpScope({ GELLO_BOARD_ROOT: ROOT }, "/anywhere")).toThrow(
      /GELLO_CARD_ID/,
    );
  });

  it("fails clearly when no board can be found", () => {
    // "/" has no .gello above it, so the cwd fallback finds nothing.
    expect(() => resolveMcpScope({ GELLO_CARD_ID: "c001" }, "/")).toThrow(/no .gello board/);
  });
});
