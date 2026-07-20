#!/usr/bin/env -S npx tsx
// gello-companion (c0093 scaffold → c0097 dispatch) — a standalone Node CLI
// that watches a gello board and runs an agent on each card entering `ready`,
// managing the run through the card-based Q&A park/resume (c0096). It reuses
// the board core in `src/lib` (no re-parsing) and publishes a state file the
// desktop app reads.
//
// Run with tsx: `pnpm companion [dir]`.

import { watch } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findBoardRoot,
  loadBoardFrom,
  cardsEnteringReady,
  initialState,
  writeStateFile,
  companionStatePath,
  appendRunsLog,
  type CompanionState,
  type RunState,
} from "./core.ts";
import { renderEvent, type AgentEvent } from "./stream.ts";
import { cardsAwaitingInput } from "./qa.ts";
import { runAsk } from "./ask-cli.ts";
import { getAdapter, type AskServerSpec } from "./adapters.ts";
import { loadSessions, saveSessions } from "./sessions.ts";
import { loadConfig } from "./config.ts";
import { Runner, type SpawnedRun, type Spawner } from "./runner.ts";
import type { BoardModel } from "../src/lib/board.ts";

const IN_PROGRESS = "in-progress";

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function log(message: string): void {
  console.log(`[gello-companion] ${message}`);
}

/** Spawn a real agent process (c0104). stdout is **piped** — the runner parses
 *  it for tool calls, tokens and cost; inheriting it would forgo the counts and
 *  leave concurrent runs interleaving unlabelled. stderr is still inherited so
 *  the agent's own errors surface; stdin is closed (a `-p` run reads its prompt
 *  from argv). A spawn error (e.g. command not found) surfaces as a null exit
 *  code → classified as an error, non-fatal to the companion. */
const nodeSpawner: Spawner = (spec, cwd, env): SpawnedRun => {
  const child = spawn(spec.command, spec.args, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, ...env },
  });
  child.stdout?.setEncoding("utf8");
  return {
    onStdout(cb) {
      child.stdout?.on("data", (chunk: string) => cb(chunk));
    },
    onExit(cb) {
      let fired = false;
      const once = (code: number | null) => {
        if (!fired) {
          fired = true;
          cb(code);
        }
      };
      child.on("exit", (code) => once(code));
      child.on("error", (error) => {
        log(`spawn ${spec.command} failed: ${(error as Error).message}`);
        once(null);
      });
    },
  };
};

/** How the agent should launch the `add_question` MCP server (c0102): the same
 *  tsx runtime the companion itself runs under, pointed at the stdio
 *  entrypoint. The runner adds the run's card id to `env`. */
function askServerSpec(root: string): AskServerSpec {
  return {
    command: process.execPath,
    args: [
      ...process.execArgv,
      fileURLToPath(new URL("mcp-main.ts", import.meta.url)),
    ],
    env: { GELLO_BOARD_ROOT: root },
  };
}

function main(): void {
  // `ask` is the agent-facing subcommand (c0102); bare argv is the watch dir.
  if (process.argv[2] === "ask") {
    process.exit(
      runAsk(process.argv.slice(3), process.env, process.cwd(), (m) => console.log(m)),
    );
  }
  const start = resolve(process.argv[2] ?? process.cwd());
  const root = findBoardRoot(start);
  if (!root) {
    console.error(`no .gello board found from ${start}`);
    process.exit(1);
  }
  const projectDir = dirname(root);
  // Per-project config (`.gello/companion.yaml`) with env overrides (c0099).
  // Headless runs need a pre-approving permission mode or every write/command
  // is denied (a `-p` agent can't answer an approval prompt); the `auto`
  // default approves autonomously while still honoring deny-rules.
  const config = loadConfig(root);
  const { agent: agentName, scope, trigger, permissionMode, level } = config;
  log(
    `watching board at ${root} (agent: ${agentName}, scope: ${scope}, ` +
      `trigger: ${trigger}, permissions: ${permissionMode}, level: ${level})`,
  );

  // c0104: a run's parsed events go to two persistent surfaces. The terminal
  // gets a level-gated, card-id-prefixed line (`emit`); runs.log gets the full
  // verbose transcript of every event, for inspecting a finished run later.
  const emit = (line: string) => console.log(line);
  const appendRunLog = (cardId: string, event: AgentEvent) => {
    try {
      for (const line of renderEvent("verbose", cardId, event)) appendRunsLog(root, line);
    } catch (error) {
      log(`could not append to runs.log: ${(error as Error).message}`);
    }
  };

  let model: BoardModel = loadBoardFrom(root);
  let runs: RunState[] = [];

  const runner = new Runner({
    cwd: projectDir, // the agent works the repo, not the board folder
    boardRoot: root, // card paths are relative to .gello
    adapter: getAdapter(agentName),
    scope,
    trigger,
    permissionMode,
    wipLimit: model.config.wipLimits[IN_PROGRESS] ?? Infinity,
    level,
    emit,
    appendRunLog,
    spawn: nodeSpawner,
    askServer: askServerSpec(root),
    reload: () => loadBoardFrom(root),
    sessions: loadSessions(root),
    persistSessions: (map) => saveSessions(root, map),
    onRuns: (next) => {
      runs = next;
      publish(root, model, runs, trigger);
    },
    log,
  });

  publish(root, model, runs, trigger);
  runner.sync(model);

  // Debounce watcher bursts (an atomic write is a delete+create; a triage
  // touches several files); reload once things settle, then let the runner
  // reconcile. Ignore our own `.companion/` writes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(root, { recursive: true }, (_event, filename) => {
    if (filename && filename.replace(/\\/g, "/").startsWith(".companion/")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      let next: BoardModel;
      try {
        next = loadBoardFrom(root);
      } catch (error) {
        log(`reload failed: ${(error as Error).message}`);
        return;
      }
      model = next;
      runner.sync(next);
      publish(root, next, runs, trigger);
    }, 150);
  });
}

function overallStatus(runs: RunState[], waiting: string[]): CompanionState["status"] {
  if (runs.some((r) => r.phase === "running")) return "running";
  if (waiting.length || runs.some((r) => r.phase === "waiting-for-input")) return "waiting";
  return "idle";
}

function publish(
  root: string,
  model: BoardModel,
  runs: RunState[],
  trigger: string,
): void {
  const ready = cardsEnteringReady(null, model, trigger).map((c) => c.id);
  const waiting = cardsAwaitingInput(model).map((c) => c.id);
  const state: CompanionState = {
    ...initialState(nowIso()),
    ready,
    waiting,
    runs,
    status: overallStatus(runs, waiting),
  };
  try {
    writeStateFile(root, state);
  } catch (error) {
    log(`could not write ${companionStatePath(root)}: ${(error as Error).message}`);
  }
}

main();
