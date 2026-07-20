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
  type CompanionState,
  type RunState,
} from "./core.ts";
import { cardsAwaitingInput } from "./qa.ts";
import { runAsk } from "./ask-cli.ts";
import { getAdapter, type AskServerSpec } from "./adapters.ts";
import { loadSessions, saveSessions, type SessionScope } from "./sessions.ts";
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

/** Spawn a real agent process, inheriting stdio so its work streams to the
 *  companion's terminal. A spawn error (e.g. command not found) surfaces as a
 *  null exit code → classified as an error, non-fatal to the companion. */
const nodeSpawner: Spawner = (spec, cwd, env): SpawnedRun => {
  const child = spawn(spec.command, spec.args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  return {
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
  const agentName = process.env.GELLO_COMPANION_AGENT ?? "claude";
  const scope: SessionScope =
    process.env.GELLO_COMPANION_SCOPE === "epic" ? "epic" : "card";
  // Headless runs need a pre-approving permission mode or every write/command
  // is denied (a `-p` agent can't answer an approval prompt). `auto` approves
  // autonomously while still honoring deny-rules; override via env.
  const permissionMode = process.env.GELLO_COMPANION_PERMISSION_MODE ?? "auto";
  log(
    `watching board at ${root} (agent: ${agentName}, scope: ${scope}, ` +
      `permissions: ${permissionMode})`,
  );

  let model: BoardModel = loadBoardFrom(root);
  let runs: RunState[] = [];

  const runner = new Runner({
    root: projectDir, // the agent runs in the repo, not inside .gello
    adapter: getAdapter(agentName),
    scope,
    permissionMode,
    wipLimit: model.config.wipLimits[IN_PROGRESS] ?? Infinity,
    spawn: nodeSpawner,
    askServer: askServerSpec(root),
    reload: () => loadBoardFrom(root),
    sessions: loadSessions(root),
    persistSessions: (map) => saveSessions(root, map),
    onRuns: (next) => {
      runs = next;
      publish(root, model, runs);
    },
    log,
  });

  publish(root, model, runs);
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
      publish(root, next, runs);
    }, 150);
  });
}

function overallStatus(runs: RunState[], waiting: string[]): CompanionState["status"] {
  if (runs.some((r) => r.phase === "running")) return "running";
  if (waiting.length || runs.some((r) => r.phase === "waiting-for-input")) return "waiting";
  return "idle";
}

function publish(root: string, model: BoardModel, runs: RunState[]): void {
  const ready = cardsEnteringReady(null, model).map((c) => c.id);
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
