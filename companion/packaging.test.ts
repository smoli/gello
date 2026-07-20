import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// c0099 packaging contract: the companion is installable as a `gello-companion`
// CLI. These guard the run path the README documents so it can't silently rot.
// Vitest runs with cwd at the repo root.

const repoRoot = process.cwd();
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

describe("packaging", () => {
  it("exposes a gello-companion bin pointing at an existing entrypoint", () => {
    const bin = pkg.bin?.["gello-companion"];
    expect(bin).toBeTruthy();
    expect(existsSync(join(repoRoot, bin))).toBe(true);
  });

  it("the bin entrypoint has a tsx shebang so it runs standalone", () => {
    const bin = pkg.bin["gello-companion"];
    const first = readFileSync(join(repoRoot, bin), "utf8").split("\n")[0];
    expect(first.startsWith("#!")).toBe(true);
    expect(first).toContain("tsx");
  });
});
