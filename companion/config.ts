// gello-companion configuration (c0099). Per-project companion settings live in
// `.gello/companion.yaml` — committed, so board-level workflow (session scope,
// trigger, run backend) travels with the board, matching the e08 principle that
// app and companion coordinate only through `.gello/` files. Per-machine
// concerns (which agent CLI is installed, its permission mode) override via env
// vars, so a teammate without a given backend needn't touch committed config.
//
// Precedence: env var > companion.yaml > built-in default. An absent file means
// all defaults; a malformed one fails fast (running the wrong backend silently
// is worse than a clear startup error). We only ever *parse* YAML here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { ADAPTER_NAMES } from "./adapters.ts";
import { LEVELS, type Level } from "./stream.ts";
import type { SessionScope } from "./sessions.ts";

export interface CompanionConfig {
  /** Agent backend: one of the adapter names (`claude`, `pi`). */
  agent: string;
  /** One session per `card` (default) or shared per `epic`. */
  scope: SessionScope;
  /** The status whose entry dispatches a run (default `ready`). */
  trigger: string;
  /** Headless permission posture handed to the backend (adapter-specific). */
  permissionMode: string;
  /** Terminal verbosity for a run (c0104): `quiet` (lifecycle lines only),
   *  `normal` (plus tool calls and a token/cost summary), or `verbose` (plus
   *  the agent's assistant text). */
  level: Level;
}

export const DEFAULT_CONFIG: CompanionConfig = {
  agent: "claude",
  scope: "epic",
  trigger: "ready",
  permissionMode: "auto",
  level: "normal",
};

/** Absolute path of the per-project config file (`<root>/companion.yaml`). */
export function companionConfigPath(root: string): string {
  return join(root, "companion.yaml");
}

function coerceScope(value: unknown, fallback: SessionScope): SessionScope {
  return value === "card" || value === "epic" ? value : fallback;
}

function coerceLevel(value: unknown, fallback: Level): Level {
  return LEVELS.includes(value as Level) ? (value as Level) : fallback;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The parsed file layer: the mapping, or null when the file is absent. Throws
 *  with the path on unparseable YAML or a non-mapping document. */
function readFileLayer(root: string): Record<string, unknown> | null {
  const path = companionConfigPath(root);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null; // absent → all defaults
  }
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    throw new Error(`invalid ${path}: ${(error as Error).message}`);
  }
  if (parsed == null) return {}; // empty file → defaults
  if (typeof parsed !== "object") {
    throw new Error(`invalid ${path}: expected a mapping of settings`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Resolve the effective companion config for a board root. `env` is injected so
 * callers (and tests) control the environment layer; production passes
 * `process.env`.
 */
export function loadConfig(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): CompanionConfig {
  const file = readFileLayer(root) ?? {};

  const agent =
    env.GELLO_COMPANION_AGENT ?? asString(file.agent) ?? DEFAULT_CONFIG.agent;
  if (!ADAPTER_NAMES.includes(agent)) {
    throw new Error(
      `unknown agent backend "${agent}" (have: ${ADAPTER_NAMES.join(", ")})`,
    );
  }

  const scope = coerceScope(
    env.GELLO_COMPANION_SCOPE ?? file.scope,
    DEFAULT_CONFIG.scope,
  );
  const trigger =
    env.GELLO_COMPANION_TRIGGER ??
    asString(file.trigger) ??
    DEFAULT_CONFIG.trigger;
  const permissionMode =
    env.GELLO_COMPANION_PERMISSION_MODE ??
    asString(file.permissionMode) ??
    DEFAULT_CONFIG.permissionMode;
  const level = coerceLevel(
    env.GELLO_COMPANION_LEVEL ?? file.level,
    DEFAULT_CONFIG.level,
  );

  return { agent, scope, trigger, permissionMode, level };
}
