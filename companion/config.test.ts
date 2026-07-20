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

  it("reads backend, scope, trigger and permission mode from companion.yaml", () => {
    const root = tempGello();
    writeConfig(
      root,
      "agent: pi\nscope: epic\ntrigger: backlog\npermissionMode: default\n",
    );
    expect(loadConfig(root, {})).toEqual({
      agent: "pi",
      scope: "epic",
      trigger: "backlog",
      permissionMode: "default",
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
    });
    expect(cfg).toEqual({
      agent: "claude",
      scope: "card",
      trigger: "ready",
      permissionMode: "auto",
    });
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
