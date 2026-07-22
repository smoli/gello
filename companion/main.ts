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
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { renderEvent, type AgentEvent } from "./stream.ts";
import { cardsAwaitingInput } from "./qa.ts";
import { runAsk } from "./ask-cli.ts";
import { createGelloServer } from "./mcp.ts";
import { MCP_SUBCOMMAND, askServerSpec, resolveMcpScope } from "./ask-server.ts";
import {
  LogPanes,
  addUsage,
  boardSlice,
  emptyTotals,
  formatActivity,
  renderMode,
} from "./tui-model.ts";
import { Dashboard, nodeScreen } from "./tui.ts";
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

/** Where the companion's own lifecycle lines go. Plain mode prints them; the
 *  TUI (c0112) owns the screen, so it swaps this for the frame's status line —
 *  otherwise these writes would tear the frame apart. */
let logSink: (message: string) => void = (message) =>
  console.log(`[gello-companion] ${message}`);

function log(message: string): void {
  logSink(message);
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

/** How the agent should launch the `add_question` MCP server (c0102): re-invoke
 *  *this* entry with the `mcp` subcommand (i0118). Using `import.meta.url` means
 *  the same code works whether the entry is `main.ts` under tsx or the bundled
 *  `.mjs` in the installed app — each knows its own path. The runner adds the
 *  run's card id to `env`. */
function currentAskServer(root: string): AskServerSpec {
  return askServerSpec(
    fileURLToPath(import.meta.url),
    process.execPath,
    process.execArgv,
    root,
  );
}

/** The MCP stdio server, run as a subcommand of this entry (i0118). stdout is
 *  the JSON-RPC channel — diagnostics must go to stderr. */
async function runMcpServer(): Promise<never> {
  try {
    const { cardId, root } = resolveMcpScope(process.env, process.cwd());
    await createGelloServer(root, cardId).connect(new StdioServerTransport());
  } catch (error) {
    console.error(`gello mcp server failed: ${(error as Error).message}`);
    process.exit(1);
  }
  return new Promise<never>(() => {}); // stay alive on the transport
}

function main(): void {
  // `ask` is the agent-facing subcommand (c0102); bare argv is the watch dir.
  if (process.argv[2] === "ask") {
    process.exit(
      runAsk(process.argv.slice(3), process.env, process.cwd(), (m) => console.log(m)),
    );
  }
  // `mcp` (i0118) serves the stdio MCP server from this same entry, so the
  // shipped bundle needs no sibling `.ts` file.
  if (process.argv[2] === MCP_SUBCOMMAND) {
    void runMcpServer();
    return;
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
  const { agent: agentName, scope, trigger, permissionMode, level, pickupDelay } = config;
  log(
    `watching board at ${root} (agent: ${agentName}, scope: ${scope}, ` +
      `trigger: ${trigger}, permissions: ${permissionMode}, level: ${level}, ` +
      `pickup delay: ${pickupDelay}s)`,
  );

  // c0104: a run's parsed events go to two persistent surfaces. The terminal
  // gets a level-gated, card-id-prefixed line (`emit`); runs.log gets the full
  // verbose transcript of every event, for inspecting a finished run later.
  // c0112: a TTY gets the dashboard, anything piped or redirected keeps the
  // plain lines. The two differ only in where `emit` sends a line — runs.log is
  // written from `appendRunLog` either way, so the transcript is identical.
  const mode = renderMode(process.stdout);
  const panes = new LogPanes();
  const emit =
    mode === "tui"
      ? (line: string, cardId: string) => panes.append(cardId, line)
      : (line: string) => console.log(line);

  const startedAt = Date.now();
  const runStartedAt = new Map<string, number>();
  let totals = emptyTotals();
  let dashboard: Dashboard | undefined;

  const appendRunLog = (cardId: string, event: AgentEvent) => {
    if (event.kind === "usage") totals = addUsage(totals, event.usage);
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
    pickupDelayMs: pickupDelay * 1000,
    emit,
    appendRunLog,
    spawn: nodeSpawner,
    askServer: currentAskServer(root),
    reload: () => loadBoardFrom(root),
    sessions: loadSessions(root),
    persistSessions: (map) => saveSessions(root, map),
    onRuns: (next) => {
      const ended = new Set(runs.map((r) => r.cardId));
      for (const run of next) {
        ended.delete(run.cardId);
        if (!runStartedAt.has(run.cardId)) runStartedAt.set(run.cardId, Date.now());
      }
      // a finished run's pane goes with it; runs.log keeps the full record
      for (const cardId of ended) {
        panes.drop(cardId);
        runStartedAt.delete(cardId);
      }
      runs = next;
      publish(root, model, runs, trigger, pickupDelay);
      dashboard?.draw();
    },
    log,
  });

  publish(root, model, runs, trigger, pickupDelay);

  if (mode === "tui") {
    const titleOf = (cardId: string) =>
      [...model.cards, ...model.epics.flatMap((e) => e.cards)].find((c) => c.id === cardId)
        ?.title ?? cardId;
    let status: string | undefined;

    dashboard = new Dashboard(
      nodeScreen(process.stdout, process.stdin),
      (selected) => ({
        boardRoot: root,
        agent: agentName,
        model: runs.find((r) => r.model)?.model,
        scope,
        trigger,
        permissionMode,
        wipLimit: model.config.wipLimits[IN_PROGRESS] ?? Infinity,
        startedAt,
        totals,
        board: boardSlice(model, trigger),
        runs: runs.map((run) => ({
          cardId: run.cardId,
          title: titleOf(run.cardId),
          phase: run.phase,
          startedAt: runStartedAt.get(run.cardId) ?? startedAt,
          usage: run.usage,
          activity: formatActivity(run.activity),
        })),
        paneLines: panes.lines(selected ?? ""),
        now: Date.now(),
        status,
      }),
      () => runs.map((r) => r.cardId),
      () => process.exit(0),
    );

    // lifecycle lines can no longer go to stdout — show the newest in the frame
    logSink = (message) => {
      status = message;
      dashboard?.draw();
    };
    panes.subscribe(() => dashboard?.draw());
    dashboard.start();
    // the header's clock and each run's elapsed have to keep ticking
    setInterval(() => dashboard?.draw(), 500).unref?.();
    // raw mode swallows SIGINT (the dashboard handles Ctrl-C itself), but a
    // signal from elsewhere must still put the terminal back
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, () => {
        dashboard?.stop();
        process.exit(0);
      });
    }
    process.on("exit", () => dashboard?.stop());
  }

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
      publish(root, next, runs, trigger, pickupDelay);
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
  pickupDelay: number,
): void {
  const ready = cardsEnteringReady(null, model, trigger).map((c) => c.id);
  const waiting = cardsAwaitingInput(model).map((c) => c.id);
  const state: CompanionState = {
    ...initialState(nowIso()),
    ready,
    waiting,
    runs,
    status: overallStatus(runs, waiting),
    pickupDelay,
  };
  try {
    writeStateFile(root, state);
  } catch (error) {
    log(`could not write ${companionStatePath(root)}: ${(error as Error).message}`);
  }
}

main();
