import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/lib/board.ts";
import type { BoardModel } from "../src/lib/board.ts";
import type { LaunchSpec } from "./adapters.ts";
import { claudeAdapter } from "./adapters.ts";
import {
  planDispatch,
  classifyExit,
  occupiedSlots,
  buildTaskPrompt,
  Runner,
  type SpawnedRun,
} from "./runner.ts";

// --- board fixtures ---------------------------------------------------------

const BOARD =
  "columns: [inbox, backlog, ready, in-progress, review, done]\nwip_limits:\n  in-progress: 2\n";

interface CardSpec {
  status: string;
  depends?: string[];
  order?: number;
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
    s.order !== undefined ? `order: ${s.order}` : null,
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

/** A fake process: records the spec and lets the test fire its exit. */
class FakeProc implements SpawnedRun {
  private cb: ((code: number | null) => void) | null = null;
  constructor(
    readonly spec: LaunchSpec,
    readonly env?: Record<string, string>,
  ) {}
  onExit(cb: (code: number | null) => void): void {
    this.cb = cb;
  }
  exit(code: number | null): void {
    this.cb?.(code);
  }
}

function makeRunner(initial: BoardModel, sessions?: Record<string, string>) {
  const spawned: FakeProc[] = [];
  const writes: { path: string; raw: string }[] = [];
  let model = initial;
  const published: { runs: string[] }[] = [];
  const cwds: string[] = [];
  const runner = new Runner({
    // the agent runs in the repo; card paths resolve against .gello
    cwd: "/project",
    boardRoot: "/project/.gello",
    writeCard: (path, raw) => writes.push({ path, raw }),
    askServer: { command: "tsx", args: ["/repo/companion/mcp-main.ts"], env: {} },
    adapter: claudeAdapter,
    scope: "card",
    wipLimit: 2,
    spawn: (spec, cwd, env) => {
      cwds.push(cwd);
      const proc = new FakeProc(spec, env);
      spawned.push(proc);
      return proc;
    },
    reload: () => model,
    onRuns: (runs) => published.push({ runs: runs.map((r) => `${r.cardId}:${r.phase}`) }),
    sessions,
  });
  return {
    runner,
    spawned,
    writes,
    cwds,
    published,
    setModel: (m: BoardModel) => (model = m),
    reloadModel: () => model,
    last: () => published[published.length - 1]?.runs ?? [],
  };
}

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
