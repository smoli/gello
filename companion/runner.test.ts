import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/lib/board.ts";
import type { BoardModel } from "../src/lib/board.ts";
import type { LaunchSpec } from "./adapters.ts";
import { claudeAdapter } from "./adapters.ts";
import type { AgentEvent, Level } from "./stream.ts";
import type { RunState } from "./core.ts";
import type { Scheduler } from "./throttle.ts";
import { LogPanes } from "./tui-model.ts";
import {
  planDispatch,
  classifyExit,
  occupiedSlots,
  buildTaskPrompt,
  Runner,
  type SpawnedRun,
} from "./runner.ts";

/** A claude `stream-json` line for an assistant tool_use. */
function toolLine(name: string, input: Record<string, unknown>): string {
  return `${JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name, input }] },
  })}\n`;
}

/** A claude `stream-json` line for assistant text. */
function textLine(text: string): string {
  return `${JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text }] },
  })}\n`;
}

/** A claude `stream-json` final `result` line carrying usage. */
function resultLine(usage: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return `${JSON.stringify({ type: "result", usage, ...extra })}\n`;
}

// --- board fixtures ---------------------------------------------------------

const BOARD =
  "columns: [inbox, backlog, ready, in-progress, review, done]\nwip_limits:\n  in-progress: 2\n";

interface CardSpec {
  status: string;
  depends?: string[];
  order?: number;
  /** c0126: epic membership, for the per-session-id dispatch gate. */
  epic?: string;
  /** c0117: when the card entered its status, for the pickup grace period. */
  statusChanged?: string;
  /** Question markdown parked as a `gelloquestion` fence (awaiting: input). */
  parked?: string;
  /** Answered question, un-fenced in place by the app (awaiting: answered). */
  answered?: string;
}

function cardFile(id: string, s: CardSpec): string {
  const awaiting = s.parked ? "input" : s.answered ? "answered" : null;
  const fm = [
    `id: ${id}`,
    `title: Card ${id}`,
    `status: ${s.status}`,
    s.depends ? `depends: [${s.depends.join(", ")}]` : null,
    s.epic ? `epic: ${s.epic}` : null,
    s.order !== undefined ? `order: ${s.order}` : null,
    s.statusChanged ? `status-changed: ${s.statusChanged}` : null,
    awaiting ? `awaiting: ${awaiting}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const question = s.parked
    ? `\n\n\`\`\`gelloquestion\n${s.parked.trim()}\n\`\`\``
    : s.answered
      ? `\n\n${s.answered.trim()}`
      : "";
  return `---\n${fm}\n---\n\n## What\n\ntask${question}\n`;
}

function board(cards: Record<string, CardSpec>): BoardModel {
  return loadBoard([
    { path: "board.yaml", content: BOARD },
    ...Object.entries(cards).map(([id, s]) => ({
      path: `cards/${id}-x.md`,
      content: cardFile(id, s),
    })),
  ]);
}

const cardOf = (model: BoardModel, id: string) =>
  model.cards.find((c) => c.id === id)!;

// --- pure helpers -----------------------------------------------------------

describe("occupiedSlots", () => {
  it("counts in-progress cards and active runs as a union", () => {
    const model = board({ c001: { status: "in-progress" }, c002: { status: "ready" } });
    expect(occupiedSlots(model, [])).toBe(1); // c001 in-progress
    expect(occupiedSlots(model, ["c002"])).toBe(2); // + c002 active run
    expect(occupiedSlots(model, ["c001"])).toBe(1); // c001 counted once (union)
  });
});

describe("planDispatch", () => {
  it("dispatches ready cards up to the WIP budget, queues the rest", () => {
    const model = board({
      c001: { status: "ready", order: 1 },
      c002: { status: "ready", order: 2 },
      c003: { status: "ready", order: 3 },
    });
    const { dispatch, queued } = planDispatch(model, [], 2);
    expect(dispatch.map((c) => c.id)).toEqual(["c001", "c002"]);
    expect(queued.map((c) => c.id)).toEqual(["c003"]);
  });

  it("queues an unordered follow-up behind cards already ordered in ready (c0115)", () => {
    // a follow-up is created without an `order`, so it sorts last
    const model = board({
      c001: { status: "ready", order: 1 },
      c002: { status: "ready", order: 2 },
      c0115: { status: "ready" },
    });
    const { dispatch, queued } = planDispatch(model, [], 2);
    expect(dispatch.map((c) => c.id)).toEqual(["c001", "c002"]);
    expect(queued.map((c) => c.id)).toEqual(["c0115"]);
  });

  it("dispatches a fresh follow-up with no further action when a slot is free (c0115)", () => {
    // the common case while reviewing finished work: the ready column is empty
    const model = board({ c0115: { status: "ready" } });
    const { dispatch } = planDispatch(model, [], 2);
    expect(dispatch.map((c) => c.id)).toEqual(["c0115"]);
  });

  it("counts existing in-progress work against the budget", () => {
    const model = board({
      c001: { status: "in-progress" },
      c002: { status: "ready", order: 1 },
      c003: { status: "ready", order: 2 },
    });
    const { dispatch, queued } = planDispatch(model, [], 2);
    expect(dispatch.map((c) => c.id)).toEqual(["c002"]); // one slot left
    expect(queued.map((c) => c.id)).toEqual(["c003"]);
  });

  it("does not re-dispatch a card that already has an active run", () => {
    const model = board({ c001: { status: "ready", order: 1 } });
    expect(planDispatch(model, ["c001"], 2).dispatch).toEqual([]);
  });

  it("dispatches on a custom trigger status when configured (c0099)", () => {
    const model = board({
      c001: { status: "backlog", order: 1 },
      c002: { status: "ready", order: 2 },
    });
    // trigger=backlog: c001 dispatches, the ready card does not.
    expect(planDispatch(model, [], 2, "backlog").dispatch.map((c) => c.id)).toEqual([
      "c001",
    ]);
    // default trigger stays `ready`.
    expect(planDispatch(model, [], 2).dispatch.map((c) => c.id)).toEqual(["c002"]);
  });

  it("skips a ready card whose depends are not all done", () => {
    const model = board({
      c001: { status: "ready", order: 1, depends: ["c009"] }, // c009 absent → not done
      c002: { status: "ready", order: 2, depends: ["c003"] },
      c003: { status: "done" },
    });
    const { dispatch } = planDispatch(model, [], 2);
    expect(dispatch.map((c) => c.id)).toEqual(["c002"]); // c001 blocked by c009
  });

  // i0119: a blocked card used to be filtered out of the candidate list and
  // never mentioned again, so the companion sat silent and looked broken.
  it("reports a blocked card with the depends that are not done", () => {
    const model = board({
      c001: { status: "ready", order: 1, depends: ["c003", "c009"] },
      c003: { status: "done" },
      c009: { status: "backlog" },
    });
    const { dispatch, blocked } = planDispatch(model, [], 2);

    expect(dispatch).toEqual([]);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].card.id).toBe("c001");
    expect(blocked[0].missing).toEqual(["c009"]); // c003 is done, so not listed
  });

  it("counts an absent dependency as missing", () => {
    const model = board({ c001: { status: "ready", depends: ["c404"] } });
    expect(planDispatch(model, [], 2).blocked[0].missing).toEqual(["c404"]);
  });

  it("reports nothing blocked when every dependency is done", () => {
    const model = board({
      c001: { status: "ready", depends: ["c003"] },
      c003: { status: "done" },
    });
    expect(planDispatch(model, [], 2).blocked).toEqual([]);
  });

  it("does not report a card in another status as blocked", () => {
    const model = board({ c001: { status: "backlog", depends: ["c404"] } });
    expect(planDispatch(model, [], 2).blocked).toEqual([]);
  });
});

// c0117: a card must sit in the trigger status for the grace period before it
// is picked up, so an accidental drag can be undone before tokens are spent.
describe("planDispatch — pickup delay", () => {
  const T0 = Date.parse("2026-07-22T10:00:00");
  const stamped = (status: string, statusChanged: string, order = 1) => ({
    status,
    order,
    statusChanged,
  });

  it("holds a card back until the delay has elapsed", () => {
    const model = board({ c001: stamped("ready", "2026-07-22T10:00:00") });
    const plan = planDispatch(model, [], 2, "ready", { now: T0 + 5_000, pickupDelayMs: 10_000 });

    expect(plan.dispatch).toEqual([]);
    expect(plan.delayed.map((d) => d.card.id)).toEqual(["c001"]);
    expect(plan.delayed[0].msRemaining).toBe(5_000);
  });

  it("dispatches once the delay has elapsed", () => {
    const model = board({ c001: stamped("ready", "2026-07-22T10:00:00") });
    const plan = planDispatch(model, [], 2, "ready", { now: T0 + 10_000, pickupDelayMs: 10_000 });

    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001"]);
    expect(plan.delayed).toEqual([]);
  });

  it("dispatches immediately when the delay is zero", () => {
    const model = board({ c001: stamped("ready", "2026-07-22T10:00:00") });
    const plan = planDispatch(model, [], 2, "ready", { now: T0, pickupDelayMs: 0 });
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001"]);
  });

  it("treats a card with no status-changed as eligible, never blocked forever", () => {
    const model = board({ c001: { status: "ready", order: 1 } });
    const plan = planDispatch(model, [], 2, "ready", { now: T0, pickupDelayMs: 10_000 });
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001"]);
  });

  it("treats an unparseable status-changed as eligible", () => {
    const model = board({ c001: stamped("ready", "not a date") });
    const plan = planDispatch(model, [], 2, "ready", { now: T0, pickupDelayMs: 10_000 });
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001"]);
  });

  it("still honours the WIP limit — the delay is an extra gate, not a swap", () => {
    const model = board({
      c001: stamped("ready", "2026-07-22T09:00:00", 1),
      c002: stamped("ready", "2026-07-22T09:00:00", 2),
      c003: stamped("ready", "2026-07-22T09:00:00", 3),
    });
    // all three are past the delay, but the budget is 2
    const plan = planDispatch(model, [], 2, "ready", { now: T0, pickupDelayMs: 10_000 });
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001", "c002"]);
    expect(plan.queued.map((c) => c.id)).toEqual(["c003"]);
  });

  it("does not count a delayed card against the dependency report", () => {
    const model = board({ c001: stamped("ready", "2026-07-22T10:00:00") });
    const plan = planDispatch(model, [], 2, "ready", { now: T0, pickupDelayMs: 10_000 });
    expect(plan.blocked).toEqual([]);
    expect(plan.queued).toEqual([]);
  });

  it("defaults to no delay, so existing callers are unchanged", () => {
    const model = board({ c001: stamped("ready", "2026-07-22T10:00:00") });
    expect(planDispatch(model, [], 2).dispatch.map((c) => c.id)).toEqual(["c001"]);
  });
});

// c0126: one active run per session id. Under epic scope every card in an epic
// shares `epic:<id>`, so only one runs at a time; cards in different epics (or
// standalone) keep distinct keys and parallelise.
describe("planDispatch — session gate", () => {
  it("serialises two ready cards in one epic under epic scope", () => {
    const model = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    const plan = planDispatch(model, [], 4, "ready", undefined, "epic");
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001"]); // only the first
    expect(plan.sessionHeld.map((h) => h.card.id)).toEqual(["c002"]);
    expect(plan.sessionHeld[0].heldBy).toBe("c001"); // names who holds it
  });

  it("runs cards in different epics concurrently up to the WIP limit", () => {
    const model = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e02" },
    });
    const plan = planDispatch(model, [], 4, "ready", undefined, "epic");
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001", "c002"]);
    expect(plan.sessionHeld).toEqual([]);
  });

  it("holds a ready card whose epic already has an active run", () => {
    const model = board({
      c001: { status: "in-progress", epic: "e01" }, // the active card, on the board
      c002: { status: "ready", order: 1, epic: "e01" },
    });
    const plan = planDispatch(model, ["c001"], 4, "ready", undefined, "epic");
    expect(plan.dispatch).toEqual([]);
    expect(plan.sessionHeld.map((h) => h.card.id)).toEqual(["c002"]);
    expect(plan.sessionHeld[0].heldBy).toBe("c001");
  });

  it("does not block a standalone card by an epic card's session, or vice versa", () => {
    const model = board({
      c001: { status: "in-progress", epic: "e01" },
      c002: { status: "ready", order: 1 }, // standalone → card:c002
    });
    const plan = planDispatch(model, ["c001"], 4, "ready", undefined, "epic");
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c002"]);
    expect(plan.sessionHeld).toEqual([]);
  });

  it("never serialises under card scope — every key is unique", () => {
    const model = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    const plan = planDispatch(model, [], 4, "ready", undefined, "card");
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001", "c002"]);
    expect(plan.sessionHeld).toEqual([]);
  });

  it("composes with the WIP limit — a session-free card can still be WIP-queued", () => {
    const model = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" }, // session-held behind c001
      c003: { status: "ready", order: 3, epic: "e02" },
      c004: { status: "ready", order: 4, epic: "e03" },
    });
    const plan = planDispatch(model, [], 2, "ready", undefined, "epic");
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001", "c003"]); // WIP 2
    expect(plan.queued.map((c) => c.id)).toEqual(["c004"]); // over budget, not session
    expect(plan.sessionHeld.map((h) => h.card.id)).toEqual(["c002"]); // session, not WIP
  });

  it("composes with the depends gate — a blocked card is reported blocked, not session-held", () => {
    const model = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01", depends: ["c009"] }, // c009 not done
    });
    const plan = planDispatch(model, [], 4, "ready", undefined, "epic");
    expect(plan.dispatch.map((c) => c.id)).toEqual(["c001"]);
    expect(plan.blocked.map((b) => b.card.id)).toEqual(["c002"]);
    expect(plan.sessionHeld).toEqual([]); // depends wins the report
  });

  it("defaults to no serialisation, so existing callers are unchanged", () => {
    const model = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    // no scope argument → card scope → both dispatch
    expect(planDispatch(model, [], 4).dispatch.map((c) => c.id)).toEqual(["c001", "c002"]);
  });
});

describe("classifyExit", () => {
  it("non-zero exit is an error", () => {
    const model = board({ c001: { status: "in-progress" } });
    expect(classifyExit(cardOf(model, "c001"), 1)).toBe("error");
  });

  it("clean exit with a parked open turn is waiting-for-input", () => {
    const model = board({
      c001: { status: "in-progress", parked: "### Which db?\n\n- [ ] Postgres\n" },
    });
    expect(classifyExit(cardOf(model, "c001"), 0)).toBe("waiting-for-input");
  });

  it("clean exit with no open turn is done", () => {
    const model = board({ c001: { status: "review" } });
    expect(classifyExit(cardOf(model, "c001"), 0)).toBe("done");
  });

  it("clean exit with an answered open turn is done (not still waiting)", () => {
    const model = board({
      c001: { status: "in-progress", answered: "### Which db?\n\n- [x] Postgres\n" },
    });
    expect(classifyExit(cardOf(model, "c001"), 0)).toBe("done");
  });
});

describe("buildTaskPrompt", () => {
  it("names the card and points the agent at the add_question tool", () => {
    const model = board({ c001: { status: "ready" } });
    const prompt = buildTaskPrompt(cardOf(model, "c001"), false);
    expect(prompt).toContain("c001");
    expect(prompt).toContain("cards/c001-x.md");
    expect(prompt).toContain("add_question");
  });

  // c0102: the tool owns the format. A prompt that also describes a markdown
  // shape is what let the agent hand-roll a non-conforming question.
  it("does not teach a question markdown format", () => {
    const model = board({ c001: { status: "ready" } });
    const prompt = buildTaskPrompt(cardOf(model, "c001"), false);
    expect(prompt).not.toMatch(/Open question/i);
    expect(prompt).not.toMatch(/gelloquestion/i);
  });

  // c0105: the human should see the pickup immediately, before the agent does
  // any (potentially long) analysis — so the prompt directs an early move via
  // the set_status tool, first thing.
  it("tells the agent to move to in-progress right away via set_status", () => {
    const model = board({ c001: { status: "ready" } });
    const prompt = buildTaskPrompt(cardOf(model, "c001"), false);
    expect(prompt).toContain("set_status");
    expect(prompt).toMatch(/in-progress/);
    expect(prompt).toMatch(/right away|before.*analysis|first/i);
  });

  it("resume prompt tells the agent the question was answered", () => {
    const model = board({ c001: { status: "in-progress" } });
    expect(buildTaskPrompt(cardOf(model, "c001"), true)).toMatch(/answered/i);
  });

  // The agent's harness only commits when the user asks, so an unprompted run
  // ends with "I didn't commit (you didn't ask)". The companion is the
  // delegating user here, so it must ask — while deferring *what* a commit
  // looks like to the repo's own CLAUDE.md (the companion is used across
  // projects and has no business imposing a policy). Pushing stays off.
  it("authorizes committing, defers the policy to CLAUDE.md, and forbids pushing", () => {
    const model = board({ c001: { status: "ready" } });
    for (const resuming of [false, true]) {
      const prompt = buildTaskPrompt(cardOf(model, "c001"), resuming);
      expect(prompt).toMatch(/commit/i);
      expect(prompt).toContain("CLAUDE.md");
      expect(prompt).toMatch(/never push|do not push/i);
    }
  });

  it("does not hard-code a commit policy of its own", () => {
    const model = board({ c001: { status: "ready" } });
    const prompt = buildTaskPrompt(cardOf(model, "c001"), false);
    // no branching / message-format rules invented here — CLAUDE.md decides
    expect(prompt).not.toMatch(/branch per card|create a branch|prefix the message/i);
  });
});

// --- Runner (lifecycle with a fake spawner) ---------------------------------

/** A fake process: records the spec and lets the test fire stdout and exit. */
class FakeProc implements SpawnedRun {
  private cb: ((code: number | null) => void) | null = null;
  private stdoutCb: ((chunk: string) => void) | null = null;
  constructor(
    readonly spec: LaunchSpec,
    readonly env?: Record<string, string>,
  ) {}
  onExit(cb: (code: number | null) => void): void {
    this.cb = cb;
  }
  onStdout(cb: (chunk: string) => void): void {
    this.stdoutCb = cb;
  }
  stdout(chunk: string): void {
    this.stdoutCb?.(chunk);
  }
  exit(code: number | null): void {
    this.cb?.(code);
  }
}

/** A manual clock + scheduler so the activity throttle is deterministic and
 *  leaves no real timers pending between tests. */
function fakeClock(start = 0) {
  let now = start;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const scheduler: Scheduler = {
    set(fn, ms) {
      const id = nextId++;
      pending.set(id, { at: now + ms, fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clear(id) {
      pending.delete(id as unknown as number);
    },
  };
  return {
    now: () => now,
    scheduler,
    advance(ms: number) {
      now += ms;
      for (const [id, task] of [...pending]) {
        if (task.at <= now) {
          pending.delete(id);
          task.fn();
        }
      }
    },
  };
}

function makeRunner(
  initial: BoardModel,
  sessions?: Record<string, string>,
  level: Level = "normal",
  /** c0117: the pickup grace period, and a clock aligned with the fixtures'
   *  `status-changed` stamps so the wait is comparable. */
  pickup: { pickupDelayMs?: number; clockStart?: number } = {},
  /** c0126: session scope for the dispatch gate (default `card`). */
  scope: "card" | "epic" = "card",
) {
  const spawned: FakeProc[] = [];
  const writes: { path: string; raw: string }[] = [];
  let model = initial;
  const published: { runs: string[] }[] = [];
  const publishedRaw: RunState[][] = [];
  const emitted: string[] = [];
  const panes = new LogPanes();
  const runLog: { cardId: string; event: AgentEvent }[] = [];
  const cwds: string[] = [];
  const logs: string[] = [];
  const clock = fakeClock(pickup.clockStart ?? 0);
  const runner = new Runner({
    // the agent runs in the repo; card paths resolve against .gello
    cwd: "/project",
    boardRoot: "/project/.gello",
    writeCard: (path, raw) => writes.push({ path, raw }),
    askServer: { command: "tsx", args: ["/repo/companion/mcp-main.ts"], env: {} },
    adapter: claudeAdapter,
    scope,
    wipLimit: 2,
    level,
    emit: (line, cardId) => {
      emitted.push(line);
      panes.append(cardId, line); // c0112: the per-card routing the TUI uses
    },
    appendRunLog: (cardId, event) => runLog.push({ cardId, event }),
    spawn: (spec, cwd, env) => {
      cwds.push(cwd);
      const proc = new FakeProc(spec, env);
      spawned.push(proc);
      return proc;
    },
    reload: () => model,
    onRuns: (runs) => {
      published.push({ runs: runs.map((r) => `${r.cardId}:${r.phase}`) });
      publishedRaw.push(runs);
    },
    sessions,
    log: (line) => logs.push(line),
    now: clock.now,
    scheduler: clock.scheduler,
    pickupDelayMs: pickup.pickupDelayMs ?? 0,
  });
  return {
    runner,
    spawned,
    writes,
    cwds,
    published,
    publishedRaw,
    emitted,
    panes,
    runLog,
    logs,
    advance: clock.advance,
    setModel: (m: BoardModel) => (model = m),
    reloadModel: () => model,
    last: () => published[published.length - 1]?.runs ?? [],
    lastRaw: () => publishedRaw[publishedRaw.length - 1] ?? [],
  };
}

// i0119 — "the companion starts but does nothing" was a blocked dependency it
// never mentioned. Every trigger-status card that is not running must say why.
describe("Runner — why a ready card is not running", () => {
  it("names the unfinished dependency instead of staying silent", () => {
    const start = board({
      c001: { status: "ready", order: 1, depends: ["c009"] },
      c009: { status: "backlog" },
    });
    const h = makeRunner(start);
    h.runner.sync(start);

    expect(h.spawned).toHaveLength(0);
    expect(h.logs.join("\n")).toContain("c001");
    expect(h.logs.join("\n")).toContain("c009");
  });

  it("says a card is over the WIP limit rather than dropping it quietly", () => {
    const start = board({
      c001: { status: "in-progress" },
      c002: { status: "in-progress" },
      c003: { status: "ready", order: 1 },
    });
    const h = makeRunner(start); // wipLimit 2, both slots taken
    h.runner.sync(start);

    expect(h.spawned).toHaveLength(0);
    expect(h.logs.join("\n")).toMatch(/c003.*(wip|limit|slot)/i);
  });

  // sync fires on every watcher tick, and a board edit is several ticks — the
  // reason must not scroll the terminal
  it("reports a reason once, not on every sync", () => {
    const start = board({
      c001: { status: "ready", depends: ["c009"] },
      c009: { status: "backlog" },
    });
    const h = makeRunner(start);
    h.runner.sync(start);
    const after = h.logs.length;
    h.runner.sync(start);
    h.runner.sync(start);
    expect(h.logs.length).toBe(after);
  });

  it("reports again when the reason changes", () => {
    const blocked = board({
      c001: { status: "ready", depends: ["c009"] },
      c009: { status: "backlog" },
    });
    const h = makeRunner(blocked);
    h.runner.sync(blocked);
    const after = h.logs.length;

    const alsoBlocked = board({
      c001: { status: "ready", depends: ["c009", "c010"] },
      c009: { status: "backlog" },
      c010: { status: "backlog" },
    });
    h.runner.sync(alsoBlocked);
    expect(h.logs.length).toBeGreaterThan(after);
    expect(h.logs[h.logs.length - 1]).toContain("c010");
  });

  it("dispatches once the dependency is done, and stops reporting it", () => {
    const blocked = board({
      c001: { status: "ready", depends: ["c009"] },
      c009: { status: "backlog" },
    });
    const h = makeRunner(blocked);
    h.runner.sync(blocked);
    expect(h.spawned).toHaveLength(0);

    const unblocked = board({
      c001: { status: "ready", depends: ["c009"] },
      c009: { status: "done" },
    });
    h.setModel(unblocked);
    h.runner.sync(unblocked);

    expect(h.spawned).toHaveLength(1);
    // the card is running now; a later sync must not re-announce it as blocked
    const after = h.logs.length;
    h.runner.sync(unblocked);
    expect(h.logs.slice(after).join("\n")).not.toContain("c009");
  });

  it("stays quiet when there is nothing in the trigger status", () => {
    const start = board({ c001: { status: "backlog" }, c002: { status: "done" } });
    const h = makeRunner(start);
    h.runner.sync(start);
    expect(h.logs).toEqual([]);
  });
});

describe("Runner", () => {
  it("dispatches a ready card: one spawn creating a new session (--session-id)", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start);
    h.runner.sync(start);

    expect(h.spawned).toHaveLength(1);
    const args = h.spawned[0].spec.args;
    expect(h.spawned[0].spec.command).toBe("claude");
    expect(args[0]).toBe("--session-id"); // brand-new session → create
    expect(args[args.length - 1]).toContain("c001"); // the prompt
    expect(h.last()).toEqual(["c001:running"]);
  });

  it("re-dispatch with a persisted session resumes it (--resume), never --session-id", () => {
    // The companion restarted: c001 is ready again and its session is already
    // in the map. Recreating the id would error ("already in use"), so resume.
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, { "card:c001": "prior-session-id" });
    h.runner.sync(start);

    const args = h.spawned[0].spec.args;
    expect(args[0]).toBe("--resume");
    expect(args[1]).toBe("prior-session-id");
    expect(args).not.toContain("--session-id");
  });

  it("a clean exit on a parked card → waiting-for-input, run stays active", () => {
    const ready = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(ready);
    h.runner.sync(ready);

    // agent moved c001 to in-progress and parked a question, then exited 0
    const parked = board({
      c001: { status: "in-progress", parked: "### Which db?\n\n- [ ] Postgres\n" },
    });
    h.setModel(parked);
    h.spawned[0].exit(0);

    expect(h.last()).toEqual(["c001:waiting-for-input"]);
  });

  it("answering a parked turn resumes the SAME session via --resume", () => {
    const ready = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(ready);
    h.runner.sync(ready);
    const sessionId = h.spawned[0].spec.args[1]; // after --session-id

    const parked = board({
      c001: { status: "in-progress", parked: "### Which db?\n\n- [ ] Postgres\n" },
    });
    h.setModel(parked);
    h.spawned[0].exit(0);

    const answered = board({
      c001: { status: "in-progress", answered: "### Which db?\n\n- [x] Postgres\n" },
    });
    h.setModel(answered);
    h.runner.sync(answered);

    expect(h.spawned).toHaveLength(2);
    expect(h.spawned[1].spec.args[0]).toBe("--resume"); // resume, not recreate
    expect(h.spawned[1].spec.args[1]).toBe(sessionId); // same id
    expect(h.last()).toEqual(["c001:running"]);
  });

  it("resumes an answered turn even with no in-memory run (companion restarted)", () => {
    // The process that parked c001 is gone; only sessions.json survived. When
    // the human answers, a fresh companion must still resume — not sit idle
    // until the card is bumped back to ready.
    const parked = board({
      c001: { status: "in-progress", parked: "### Which db?\n\n- [ ] Postgres\n" },
    });
    const h = makeRunner(parked, { "card:c001": "prior-session-id" });
    const answered = board({
      c001: { status: "in-progress", answered: "### Which db?\n\n- [x] Postgres\n" },
    });
    h.setModel(answered);
    h.runner.sync(answered);

    expect(h.spawned).toHaveLength(1);
    expect(h.spawned[0].spec.args[0]).toBe("--resume");
    expect(h.spawned[0].spec.args[1]).toBe("prior-session-id");
    expect(h.last()).toEqual(["c001:running"]);
  });

  it("resumes an answered-but-unarchived turn on startup (prev = null)", () => {
    // On a cold start, a card left answered-but-not-archived is waiting on the
    // agent, not the human — resume it.
    const answered = board({
      c001: { status: "in-progress", answered: "### Which db?\n\n- [x] Postgres\n" },
    });
    const h = makeRunner(answered, { "card:c001": "sid-1" });
    h.runner.sync(answered);

    expect(h.spawned).toHaveLength(1);
    expect(h.spawned[0].spec.args[0]).toBe("--resume");
  });

  // c0102: the ask surfaces read the card from the environment, so the agent
  // cannot park a question on a card its run is not for
  it("scopes the run to its card via GELLO_CARD_ID in the spawn environment", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start);
    h.runner.sync(start);
    expect(h.spawned[0].env?.GELLO_CARD_ID).toBe("c001");
  });

  it("stamps the run's card into the ask server config, per run", () => {
    const start = board({
      c001: { status: "ready", order: 1 },
      c002: { status: "ready", order: 2 },
    });
    const h = makeRunner(start);
    h.runner.sync(start);

    const cardOfSpawn = (i: number) => {
      const args = h.spawned[i].spec.args;
      const config = JSON.parse(args[args.indexOf("--mcp-config") + 1]);
      return config.mcpServers.gello.env.GELLO_CARD_ID;
    };
    expect(cardOfSpawn(0)).toBe("c001");
    expect(cardOfSpawn(1)).toBe("c002"); // not leaked from the first run
  });

  it("runs the agent in the repo but resolves card paths against .gello", () => {
    // These are two different directories. Conflating them wrote the cleared
    // card to <project>/cards/... (ENOENT) instead of <project>/.gello/cards/...
    const answered = board({
      c001: { status: "in-progress", answered: "### Which db?\n\n- [x] Postgres\n" },
    });
    const h = makeRunner(answered, { "card:c001": "sid-1" });
    h.runner.sync(answered);

    expect(h.cwds).toEqual(["/project"]); // agent cwd = the repo
    expect(h.writes[0].path).toBe("/project/.gello/cards/c001-x.md"); // card = .gello
  });

  it("clears the awaiting marker when it resumes, so the resume fires once", () => {
    const answered = board({
      c001: { status: "in-progress", answered: "### Which db?\n\n- [x] Postgres\n" },
    });
    const h = makeRunner(answered, { "card:c001": "sid-1" });
    h.runner.sync(answered);

    expect(h.writes).toHaveLength(1);
    // the write must land under the .gello board root, not the agent's cwd
    expect(h.writes[0].path).toBe("/project/.gello/cards/c001-x.md");
    expect(h.writes[0].raw).not.toContain("awaiting:");

    // the cleared card is what a later sync sees — no second dispatch
    h.setModel(board({ c001: { status: "in-progress" } }));
    h.runner.sync(h.reloadModel());
    expect(h.spawned).toHaveLength(1);
  });

  it("does not auto-resume an answered card the companion never started (no session)", () => {
    // A human-authored Q&A card with no session must not be spuriously
    // dispatched — the companion only continues dialogues it owns.
    const answered = board({
      c001: { status: "in-progress", answered: "### Which db?\n\n- [x] Postgres\n" },
    });
    const h = makeRunner(answered); // no sessions
    h.runner.sync(answered);
    expect(h.spawned).toHaveLength(0);
  });

  it("a clean exit with the work finished → done, run removed", () => {
    const ready = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(ready);
    h.runner.sync(ready);

    const finished = board({ c001: { status: "review" } });
    h.setModel(finished);
    h.spawned[0].exit(0);

    expect(h.last()).toEqual([]); // no active runs
  });

  it("a crashed agent → error, run removed, card left untouched (companion never edits)", () => {
    const ready = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(ready);
    h.runner.sync(ready);

    const midwork = board({ c001: { status: "in-progress" } });
    h.setModel(midwork);
    h.spawned[0].exit(1);

    expect(h.last()).toEqual([]);
    // the card was not rewritten by the runner
    expect(cardOf(h.reloadModel(), "c001").status).toBe("in-progress");
  });

  it("respects the WIP limit: three ready cards, only two spawn", () => {
    const start = board({
      c001: { status: "ready", order: 1 },
      c002: { status: "ready", order: 2 },
      c003: { status: "ready", order: 3 },
    });
    const h = makeRunner(start);
    h.runner.sync(start);
    expect(h.spawned.map((p) => p.spec.args[p.spec.args.length - 1])).toHaveLength(2);
  });
});

// c0104 — the agent's stdout is piped and parsed, not inherited.
describe("Runner — run observability (c0104)", () => {
  it("renders piped tool calls at `normal`, each prefixed with the card id", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    h.spawned[0].stdout(toolLine("Bash", { command: "ls -la" }));
    h.spawned[0].stdout(textLine("some assistant thinking"));

    expect(h.emitted).toContain("[c001] → Bash(ls -la)");
    // assistant text is verbose-only — hidden at normal
    expect(h.emitted.some((l) => l.includes("thinking"))).toBe(false);
  });

  it("shows the agent's assistant text at `verbose`", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "verbose");
    h.runner.sync(start);

    h.spawned[0].stdout(textLine("weighing the options"));
    expect(h.emitted).toContain("[c001] weighing the options");
  });

  it("prints nothing from the stream at `quiet`", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "quiet");
    h.runner.sync(start);

    h.spawned[0].stdout(toolLine("Bash", { command: "ls" }));
    h.spawned[0].stdout(resultLine({ input_tokens: 1, output_tokens: 2 }));
    expect(h.emitted).toEqual([]);
  });

  // c0126: one active run per session id, exercised through the real dispatch
// flow with the fake spawner (criterion 10).
describe("Runner — one run per session id (c0126)", () => {
  it("serialises two same-epic cards: only one spawns, the second after it ends", () => {
    const start = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    const h = makeRunner(start, undefined, "normal", {}, "epic");
    h.runner.sync(start);

    // only the first card's run started; the second is session-held
    expect(h.spawned).toHaveLength(1);
    expect(h.spawned[0].spec.args[h.spawned[0].spec.args.length - 1]).toContain("c001");
    expect(h.last()).toEqual(["c001:running"]);

    // the first finishes; a fresh sync now frees the epic's session
    h.setModel(board({ c001: { status: "review", epic: "e01" }, c002: { status: "ready", order: 2, epic: "e01" } }));
    h.spawned[0].exit(0);
    h.runner.sync(h.reloadModel());

    expect(h.spawned).toHaveLength(2);
    expect(h.spawned[1].spec.args[h.spawned[1].spec.args.length - 1]).toContain("c002");
  });

  it("reports a session-held card, naming who holds the session (i0119-style)", () => {
    const start = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    const h = makeRunner(start, undefined, "normal", {}, "epic");
    h.runner.sync(start);
    // c002 is held; the reason names c001 so a serialised epic doesn't look stalled
    expect(h.logs.join("\n")).toMatch(/c002 held: session busy with c001/);
  });

  it("frees the epic when the holder errors, with no board change to prompt it", () => {
    // an errored card is left exactly as-is, so nothing on disk changes — the
    // next same-epic card must still start once the session is free (criterion 2)
    const start = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    const h = makeRunner(start, undefined, "normal", {}, "epic");
    h.runner.sync(start);
    expect(h.spawned).toHaveLength(1);

    // c001 crashes; the board is unchanged (c001 still in-progress on disk)
    h.setModel(board({
      c001: { status: "in-progress", epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    }));
    h.spawned[0].exit(1); // no explicit sync — the runner must reconcile itself

    expect(h.spawned).toHaveLength(2);
    expect(h.spawned[1].spec.args[h.spawned[1].spec.args.length - 1]).toContain("c002");
  });

  it("runs two cross-epic cards concurrently", () => {
    const start = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e02" },
    });
    const h = makeRunner(start, undefined, "normal", {}, "epic");
    h.runner.sync(start);

    expect(h.spawned).toHaveLength(2);
    expect(h.last().sort()).toEqual(["c001:running", "c002:running"]);
  });

  it("a parked same-epic card keeps its session — the next card waits until it resumes and finishes", () => {
    const ready = board({
      c001: { status: "ready", order: 1, epic: "e01" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    const h = makeRunner(ready, undefined, "normal", {}, "epic");
    h.runner.sync(ready);
    expect(h.spawned).toHaveLength(1); // c002 session-held behind c001

    // c001 parks a question and exits clean → it stays active, holding the session
    const parked = board({
      c001: { status: "in-progress", epic: "e01", parked: "### Which db?\n\n- [ ] Postgres\n" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    h.setModel(parked);
    h.spawned[0].exit(0);
    h.runner.sync(parked);

    // c002 still may not start — the parked card holds the epic's session
    expect(h.spawned).toHaveLength(1);
    expect(h.last()).toContain("c001:waiting-for-input");

    // the human answers; c001 resumes (its own held session does not block it)
    const answered = board({
      c001: { status: "in-progress", epic: "e01", answered: "### Which db?\n\n- [x] Postgres\n" },
      c002: { status: "ready", order: 2, epic: "e01" },
    });
    h.setModel(answered);
    h.runner.sync(answered);
    expect(h.spawned).toHaveLength(2); // c001 resumed
    expect(h.spawned[1].spec.args[0]).toBe("--resume");

    // c001 finishes for real → c002 is finally free to run
    h.setModel(board({ c001: { status: "review", epic: "e01" }, c002: { status: "ready", order: 2, epic: "e01" } }));
    h.spawned[1].exit(0);
    h.runner.sync(h.reloadModel());
    expect(h.spawned).toHaveLength(3);
    expect(h.spawned[2].spec.args[h.spawned[2].spec.args.length - 1]).toContain("c002");
  });
});

// c0117: the grace period, driven entirely by the fake scheduler — no test
// here waits on real time.
describe("Runner — pickup delay (c0117)", () => {
  const T0 = Date.parse("2026-07-22T10:00:00");
  const STAMP = "2026-07-22T10:00:00";
  const opts = { pickupDelayMs: 10_000, clockStart: T0 };

  it("does not dispatch a card still inside its grace period", () => {
    const start = board({ c001: { status: "ready", order: 1, statusChanged: STAMP } });
    const h = makeRunner(start, undefined, "normal", opts);
    h.runner.sync(start);
    expect(h.spawned).toHaveLength(0);
  });

  it("dispatches once the delay elapses, without another file change", () => {
    // the watcher will not fire again while the card sits untouched, so the
    // runner has to wake itself
    const start = board({ c001: { status: "ready", order: 1, statusChanged: STAMP } });
    const h = makeRunner(start, undefined, "normal", opts);
    h.runner.sync(start);
    expect(h.spawned).toHaveLength(0);

    h.advance(10_000); // fires the runner's own re-check
    expect(h.spawned).toHaveLength(1);
    expect(h.last()).toEqual(["c001:running"]);
  });

  it("never dispatches a card dragged back out inside the window", () => {
    const start = board({ c001: { status: "ready", order: 1, statusChanged: STAMP } });
    const h = makeRunner(start, undefined, "normal", opts);
    h.runner.sync(start);

    // the human notices and drags it back to backlog
    const pulled = board({ c001: { status: "backlog", statusChanged: "2026-07-22T10:00:05" } });
    h.setModel(pulled);
    h.advance(10_000);

    expect(h.spawned).toHaveLength(0);
  });

  it("restarts the countdown when the card comes back in", () => {
    const start = board({ c001: { status: "ready", order: 1, statusChanged: STAMP } });
    const h = makeRunner(start, undefined, "normal", opts);
    h.runner.sync(start);

    // out at +5s, then back in at +8s with a fresh stamp
    h.setModel(board({ c001: { status: "backlog", statusChanged: "2026-07-22T10:00:05" } }));
    h.advance(5_000);
    const returned = board({
      c001: { status: "ready", order: 1, statusChanged: "2026-07-22T10:00:08" },
    });
    h.setModel(returned);
    h.runner.sync(returned);

    h.advance(5_000); // now +10s overall, but only 2s since it came back
    expect(h.spawned).toHaveLength(0);

    h.advance(8_000); // past the fresh stamp's window
    expect(h.spawned).toHaveLength(1);
  });

  // criterion: resuming an answered question is a deliberate act, not a drag
  it("resumes an answered card immediately, with no grace period", () => {
    const answered = board({
      c001: {
        status: "in-progress",
        statusChanged: STAMP,
        answered: "### Which db?\n\n- [x] Postgres\n",
      },
    });
    const h = makeRunner(answered, { "card:c001": "sid-1" }, "normal", opts);
    h.runner.sync(answered);

    expect(h.spawned).toHaveLength(1); // no advance() needed
    expect(h.spawned[0].spec.args[0]).toBe("--resume");
  });

  it("dispatches immediately when the delay is configured off", () => {
    const start = board({ c001: { status: "ready", order: 1, statusChanged: STAMP } });
    const h = makeRunner(start, undefined, "normal", { pickupDelayMs: 0, clockStart: T0 });
    h.runner.sync(start);
    expect(h.spawned).toHaveLength(1);
  });
});

// c0112: the TUI gives each run its own pane, so lines must be routable by
  // card rather than merged into one stream.
  it("routes each concurrent run's lines to its own card, never interleaving", () => {
    const start = board({
      c001: { status: "ready", order: 1 },
      c002: { status: "ready", order: 2 },
    });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    h.spawned[0].stdout(toolLine("Read", { file_path: "a.ts" }));
    h.spawned[1].stdout(toolLine("Read", { file_path: "b.ts" }));
    h.spawned[0].stdout(toolLine("Bash", { command: "pnpm test" }));

    expect(h.panes.lines("c001")).toEqual([
      "[c001] → Read(a.ts)",
      "[c001] → Bash(pnpm test)",
    ]);
    expect(h.panes.lines("c002")).toEqual(["[c002] → Read(b.ts)"]);
  });

  it("keeps two concurrent runs readable — every line names its own card", () => {
    const start = board({
      c001: { status: "ready", order: 1 },
      c002: { status: "ready", order: 2 },
    });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    h.spawned[0].stdout(toolLine("Read", { file_path: "a.ts" }));
    h.spawned[1].stdout(toolLine("Read", { file_path: "b.ts" }));

    expect(h.emitted).toContain("[c001] → Read(a.ts)");
    expect(h.emitted).toContain("[c002] → Read(b.ts)");
    for (const line of h.emitted) expect(line).toMatch(/^\[c00[12]\] /);
  });

  it("appends every parsed event to the runs.log transcript, regardless of level", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "quiet");
    h.runner.sync(start);

    h.spawned[0].stdout(textLine("thinking"));
    h.spawned[0].stdout(toolLine("Bash", { command: "ls" }));

    expect(h.runLog.map((e) => `${e.cardId}:${e.event.kind}`)).toEqual([
      "c001:text",
      "c001:tool",
    ]);
  });

  it("publishes a parked run's token/cost into its state entry", () => {
    const ready = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(ready, undefined, "normal");
    h.runner.sync(ready);

    // the agent emits its final usage, then parks a question and exits clean
    h.spawned[0].stdout(
      resultLine(
        { input_tokens: 120, output_tokens: 340 },
        { total_cost_usd: 0.0123 },
      ),
    );
    const parked = board({
      c001: { status: "in-progress", parked: "### Which db?\n\n- [ ] Postgres\n" },
    });
    h.setModel(parked);
    h.spawned[0].exit(0);

    const run = h.lastRaw().find((r) => r.cardId === "c001");
    expect(run?.phase).toBe("waiting-for-input");
    expect(run?.usage).toEqual({
      inputTokens: 120,
      outputTokens: 340,
      totalCostUsd: 0.0123,
    });
  });

  it("a malformed stream line is skipped, never fatal to the run", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    expect(() => h.spawned[0].stdout("this is not json\n")).not.toThrow();
    // a good line after the bad one still renders
    h.spawned[0].stdout(toolLine("Bash", { command: "echo ok" }));
    expect(h.emitted).toContain("[c001] → Bash(echo ok)");

    // and the run still finishes normally
    h.setModel(board({ c001: { status: "review" } }));
    h.spawned[0].exit(0);
    expect(h.last()).toEqual([]);
  });
});

// c0109 — the run's latest tool call is published as `activity`, throttled.
describe("Runner — live activity (c0109)", () => {
  it("publishes the latest tool call as the run's activity", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    h.spawned[0].stdout(toolLine("Read", { file_path: "src/board.ts" }));

    const run = h.lastRaw().find((r) => r.cardId === "c001");
    expect(run?.phase).toBe("running");
    expect(run?.activity).toEqual({ name: "Read", arg: "src/board.ts" });
  });

  it("coalesces a burst of tool calls into at most one write per window", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);
    const before = h.published.length;

    // three tool calls back-to-back within the throttle window
    h.spawned[0].stdout(toolLine("Read", { file_path: "a.ts" }));
    h.spawned[0].stdout(toolLine("Edit", { file_path: "b.ts" }));
    h.spawned[0].stdout(toolLine("Bash", { command: "pnpm test" }));

    // only the leading write landed so far
    expect(h.published.length).toBe(before + 1);
    h.advance(1000); // window elapses → one trailing write with the latest
    expect(h.published.length).toBe(before + 2);
    expect(h.lastRaw().find((r) => r.cardId === "c001")?.activity).toEqual({
      name: "Bash",
      arg: "pnpm test",
    });
  });

  it("drops activity from a run's state entry once it parks (waiting-for-input)", () => {
    const ready = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(ready, undefined, "normal");
    h.runner.sync(ready);

    h.spawned[0].stdout(toolLine("Bash", { command: "pnpm test" }));
    expect(h.lastRaw().find((r) => r.cardId === "c001")?.activity).toBeDefined();

    // the agent parks a question and exits clean → waiting-for-input
    const parked = board({
      c001: { status: "in-progress", parked: "### Which db?\n\n- [ ] Postgres\n" },
    });
    h.setModel(parked);
    h.spawned[0].exit(0);

    const run = h.lastRaw().find((r) => r.cardId === "c001");
    expect(run?.phase).toBe("waiting-for-input");
    expect(run?.activity).toBeUndefined(); // the needs-input badge covers a parked run
  });

  // c0112: the TUI header names the model the run actually used.
  it("publishes the model the run reports", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    h.spawned[0].stdout(
      `${JSON.stringify({
        type: "assistant",
        message: { model: "claude-opus-4-8", content: [{ type: "text", text: "hi" }] },
      })}\n`,
    );
    h.advance(1000);

    expect(h.lastRaw().find((r) => r.cardId === "c001")?.model).toBe("claude-opus-4-8");
  });

  it("has no model before the run reports one", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);
    expect(h.lastRaw().find((r) => r.cardId === "c001")?.model).toBeUndefined();
  });

  it("never writes the activity to the card file (runtime state only)", () => {
    const start = board({ c001: { status: "ready", order: 1 } });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    h.spawned[0].stdout(toolLine("Edit", { file_path: "src/x.ts" }));
    h.advance(1000);

    expect(h.writes).toEqual([]); // published only in state.json, never the card
  });

  it("keeps each concurrent run's activity attributed to its own card", () => {
    const start = board({
      c001: { status: "ready", order: 1 },
      c002: { status: "ready", order: 2 },
    });
    const h = makeRunner(start, undefined, "normal");
    h.runner.sync(start);

    h.spawned[0].stdout(toolLine("Read", { file_path: "a.ts" }));
    h.spawned[1].stdout(toolLine("Read", { file_path: "b.ts" }));
    h.advance(1000); // flush any trailing writes

    const runs = h.lastRaw();
    expect(runs.find((r) => r.cardId === "c001")?.activity).toEqual({
      name: "Read",
      arg: "a.ts",
    });
    expect(runs.find((r) => r.cardId === "c002")?.activity).toEqual({
      name: "Read",
      arg: "b.ts",
    });
  });
});
