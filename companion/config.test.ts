import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig, DEFAULT_CONFIG, companionConfigPath } from "./config.ts";

function tempGello(): string {
  const root = join(
    tmpdir(),
    `gello-companion-config-${process.pid}-${Math.random().toString(36).slice(2)}`,
    ".gello",
  );
  mkdirSync(root, { recursive: true });
  return root;
}

function writeConfig(root: string, yaml: string): void {
  writeFileSync(companionConfigPath(root), yaml);
}

describe("loadConfig", () => {
  it("returns the built-in defaults when no config file is present", () => {
    const root = tempGello();
    expect(loadConfig(root, {})).toEqual(DEFAULT_CONFIG);
  });

  it("reads backend, scope, trigger, permission mode and level from companion.yaml", () => {
    const root = tempGello();
    writeConfig(
      root,
      "agent: pi\nscope: epic\ntrigger: backlog\npermissionMode: default\nlevel: verbose\n",
    );
    expect(loadConfig(root, {})).toEqual({
      agent: "pi",
      scope: "epic",
      trigger: "backlog",
      permissionMode: "default",
      level: "verbose",
      pickupDelay: DEFAULT_CONFIG.pickupDelay, // unset in this file
    });
  });

  it("fills unspecified keys from the defaults (partial file)", () => {
    const root = tempGello();
    writeConfig(root, "scope: epic\n");
    expect(loadConfig(root, {})).toEqual({ ...DEFAULT_CONFIG, scope: "epic" });
  });

  it("lets env vars override the file", () => {
    const root = tempGello();
    writeConfig(root, "agent: pi\nscope: epic\n");
    const cfg = loadConfig(root, {
      GELLO_COMPANION_AGENT: "claude",
      GELLO_COMPANION_SCOPE: "card",
      GELLO_COMPANION_TRIGGER: "ready",
      GELLO_COMPANION_PERMISSION_MODE: "auto",
      GELLO_COMPANION_LEVEL: "quiet",
      GELLO_COMPANION_PICKUP_DELAY: "3",
    });
    expect(cfg).toEqual({
      agent: "claude",
      scope: "card",
      trigger: "ready",
      permissionMode: "auto",
      level: "quiet",
      pickupDelay: 3,
    });
  });

  it("defaults the verbosity level to normal", () => {
    const root = tempGello();
    expect(loadConfig(root, {}).level).toBe("normal");
    expect(DEFAULT_CONFIG.level).toBe("normal");
  });

  it("reads the level from companion.yaml and lets the env override it", () => {
    const root = tempGello();
    writeConfig(root, "level: verbose\n");
    expect(loadConfig(root, {}).level).toBe("verbose");
    expect(loadConfig(root, { GELLO_COMPANION_LEVEL: "quiet" }).level).toBe("quiet");
  });

  it("coerces an unknown level back to the default", () => {
    const root = tempGello();
    writeConfig(root, "level: chatty\n");
    expect(loadConfig(root, {}).level).toBe(DEFAULT_CONFIG.level);
  });

  it("honours env vars with no file (env-only, back-compat)", () => {
    const root = tempGello();
    const cfg = loadConfig(root, {
      GELLO_COMPANION_AGENT: "pi",
      GELLO_COMPANION_SCOPE: "epic",
    });
    expect(cfg).toEqual({ ...DEFAULT_CONFIG, agent: "pi", scope: "epic" });
  });

  it("coerces an invalid scope back to the default", () => {
    const root = tempGello();
    writeConfig(root, "scope: sideways\n");
    expect(loadConfig(root, {}).scope).toBe(DEFAULT_CONFIG.scope);
  });

  it("throws on an unknown agent backend", () => {
    const root = tempGello();
    writeConfig(root, "agent: cursor\n");
    expect(() => loadConfig(root, {})).toThrow(/cursor/);
  });

  it("throws with the file path when the YAML is malformed", () => {
    const root = tempGello();
    writeConfig(root, "agent: [unterminated\n");
    expect(() => loadConfig(root, {})).toThrow(/companion\.yaml/);
  });
});

// c0117: a grace period before a card entering the trigger status is picked up,
// so an accidental drag can be undone before real tokens are spent.
describe("pickupDelay", () => {
  it("defaults to 10 seconds", () => {
    expect(DEFAULT_CONFIG.pickupDelay).toBe(10);
  });

  it("reads the delay from companion.yaml and lets the env override it", () => {
    const root = tempGello();
    writeConfig(root, "pickupDelay: 30\n");
    expect(loadConfig(root, {}).pickupDelay).toBe(30);
    expect(loadConfig(root, { GELLO_COMPANION_PICKUP_DELAY: "5" }).pickupDelay).toBe(5);
  });

  it("takes 0 as immediate dispatch, not as absent", () => {
    const root = tempGello();
    writeConfig(root, "pickupDelay: 0\n");
    expect(loadConfig(root, {}).pickupDelay).toBe(0);
    expect(loadConfig(root, { GELLO_COMPANION_PICKUP_DELAY: "0" }).pickupDelay).toBe(0);
  });

  it("falls back to the default on a value that is not a usable number", () => {
    const root = tempGello();
    writeConfig(root, "pickupDelay: soon\n");
    expect(loadConfig(root, {}).pickupDelay).toBe(DEFAULT_CONFIG.pickupDelay);
    expect(loadConfig(root, { GELLO_COMPANION_PICKUP_DELAY: "abc" }).pickupDelay).toBe(
      DEFAULT_CONFIG.pickupDelay,
    );
  });

  it("refuses a negative delay, which would mean nothing", () => {
    const root = tempGello();
    writeConfig(root, "pickupDelay: -5\n");
    expect(loadConfig(root, {}).pickupDelay).toBe(DEFAULT_CONFIG.pickupDelay);
  });
});
