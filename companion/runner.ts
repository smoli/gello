// gello-companion dispatch flow (c0097): the run lifecycle. On a card entering
// `ready` the runner starts an agent run; it manages that run through parking
// (c0096) and resume, publishing each run's phase to the state file (c0093).
//
// Boundary — the companion NEVER edits cards. The *agent* does the pickup move
// to `in-progress`, all content writes, the park/History archiving, and the
// terminal `review` move (gello convention, taught via the prompt / c0099).
// To keep WIP correct despite that async status flip, the dispatch budget
// counts a card the moment it has an active run — not only once the agent has
// flipped it to `in-progress` — so two dispatches can't race past the limit.

import { join } from "node:path";
import type { BoardModel } from "../src/lib/board.ts";
import type { BoardConfig, Card } from "../src/lib/cards.ts";
import { todayIsoDate } from "../src/lib/dates.ts";
import { withAwaitingCleared } from "../src/lib/gello-question.ts";
import type { AgentAdapter, AskServerSpec, LaunchSpec } from "./adapters.ts";
import { writeCardAtomic, type RunState } from "./core.ts";
import { StreamSink, type Activity, type AgentEvent, type Level, type RunUsage } from "./stream.ts";
import { Throttle, type Scheduler } from "./throttle.ts";
import {
  resolveSession,
  recordSession,
  newSessionId,
  type SessionMap,
  type SessionScope,
} from "./sessions.ts";
import { hasOpenQuestion, cardsAnswered } from "./qa.ts";

const IN_PROGRESS = "in-progress";
const READY = "ready";
const DONE = "done";

/** Every card in the model, standalone + epic, in one flat list. */
function allCards(model: BoardModel): Card[] {
  return [...model.cards, ...model.epics.flatMap((e) => e.cards)];
}

function byId(model: BoardModel): Map<string, Card> {
  return new Map(allCards(model).map((c) => [c.id, c]));
}

/**
 * Slots occupied against the in-progress WIP limit: cards already
 * `in-progress` on the board, unioned with cards that have an active run (a
 * dispatched run occupies a slot before the agent flips the status).
 */
export function occupiedSlots(model: BoardModel, activeCardIds: string[]): number {
  const ids = new Set(activeCardIds);
  for (const card of allCards(model)) {
    if (card.status === IN_PROGRESS) ids.add(card.id);
  }
  return ids.size;
}

/** The `depends` of a card that are not `done` — an id absent from the board
 *  counts as missing. Empty means the card is dispatchable. */
function missingDepends(index: Map<string, Card>, card: Card): string[] {
  return card.depends.filter((id) => index.get(id)?.status !== DONE);
}

/** A trigger-status card held back by unfinished dependencies (i0119). */
export interface BlockedCard {
  card: Card;
  /** The `depends` ids that are not `done`, in the order the card lists them. */
  missing: string[];
}

export interface DispatchPlan {
  /** Ready cards to start now, in board order, within the WIP budget. */
  dispatch: Card[];
  /** Dispatchable-but-over-budget ready cards, waiting for a free slot. */
  queued: Card[];
  /** Ready cards waiting on a dependency, with the ids they wait on. Reported
   *  rather than silently dropped — see i0119. */
  blocked: BlockedCard[];
}

/**
 * Decide which cards to run now. Candidates are in the `trigger` status
 * (default `ready`; c0099 config can override), not already active, and
 * dependency-satisfied, taken in the board's manual order (c056); the WIP
 * budget (limit minus occupied slots) caps how many start — the rest queue and
 * drain on a later sync as slots free.
 */
export function planDispatch(
  model: BoardModel,
  activeCardIds: string[],
  wipLimit: number,
  trigger: string = READY,
): DispatchPlan {
  const index = byId(model);
  const active = new Set(activeCardIds);
  const waiting = allCards(model)
    .filter((c) => c.status === trigger && !active.has(c.id))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const blocked: BlockedCard[] = [];
  const candidates: Card[] = [];
  for (const card of waiting) {
    const missing = missingDepends(index, card);
    if (missing.length) blocked.push({ card, missing });
    else candidates.push(card);
  }

  const budget = Math.max(0, wipLimit - occupiedSlots(model, activeCardIds));
  return {
    dispatch: candidates.slice(0, budget),
    queued: candidates.slice(budget),
    blocked,
  };
}

export type RunPhase = RunState["phase"];

/**
 * Classify a finished agent process. A non-zero exit is an error. A clean exit
 * that left a parked question (c0096/c0102) means the agent is waiting
 * on the human; anything else is done.
 */
export function classifyExit(card: Card | undefined, code: number | null): RunPhase {
  if (code !== 0) return "error";
  if (card && hasOpenQuestion(card.body)) {
    return "waiting-for-input";
  }
  return "done";
}

/** The task prompt handed to the agent. Minimal here — the full convention is
 *  taught by the companion system prompt (c0099); this just points the agent
 *  at the card and the park protocol so a run is self-contained. */
// The agent's own harness commits only when the user asks, so an unprompted
// run ends with "I didn't commit (you didn't ask)" and the work piles up
// uncommitted. The companion is the delegating user, so it asks — but it does
// not say what a commit should look like: the companion runs against any
// project, and the repo's CLAUDE.md is the authority on scope, message format,
// branching, and when to commit. Pushing stays off regardless.
const COMMIT_CLAUSE =
  `Committing your work is part of this task — treat it as explicitly ` +
  `requested, and follow this repo's CLAUDE.md for when to commit, what to ` +
  `include, and the message format. Never push.`;

export function buildTaskPrompt(card: Card, resuming: boolean): string {
  if (resuming) {
    return (
      `The human answered your question on gello card ${card.id} ` +
      `(${card.path}). Re-read the card for the answer and continue the work. ` +
      COMMIT_CLAUSE
    );
  }
  // No question format here: the agent parks a question with the `add_question`
  // tool, which formats and writes it (c0102). Teaching a markdown shape in the
  // prompt is what let the agent drift off it in the first place.
  //
  // c0105: the status moves go through `set_status`. The in-progress move is
  // called out as the first action, before any analysis — otherwise the human
  // watches a card sit in `ready` while the agent thinks, unsure it was picked
  // up at all.
  return (
    `Work gello card ${card.id} — "${card.title}" (${card.path}). First, right ` +
    `away and before any analysis, call the \`set_status\` tool with ` +
    `\`in-progress\` so the human sees you have picked the card up. Then follow ` +
    `the gello workflow in CLAUDE.md: work test-first, keep Notes/Log current, ` +
    `and call \`set_status\` with \`review\` when the acceptance criteria pass. ` +
    `If you need a human decision, call the \`add_question\` tool and then exit ` +
    `— the human answers on the card and you are resumed. ` +
    COMMIT_CLAUSE
  );
}

// --- the runner -------------------------------------------------------------

/** A spawned agent process, reduced to what the runner needs: an exit hook and
 *  (c0104) its piped stdout, delivered in arbitrary chunks. `onStdout` is
 *  optional so an interactive run — which has no piped stream — can omit it. */
export interface SpawnedRun {
  onExit(cb: (code: number | null) => void): void;
  onStdout?(cb: (chunk: string) => void): void;
}

/** Launches an agent process from a spec. Real impl wraps `child_process`;
 *  tests pass a fake. `env` is overlaid on the companion's own environment. */
export type Spawner = (
  spec: LaunchSpec,
  cwd: string,
  env: Record<string, string>,
) => SpawnedRun;

export interface RunnerOptions {
  /** Working directory for the agent process: the **project root** (the repo),
   *  since the agent works the codebase, not the board folder. */
  cwd: string;
  /** Absolute **`.gello` root**. Card paths (`card.path`) are relative to this,
   *  so they must resolve against it — not against `cwd`, which is its parent. */
  boardRoot: string;
  adapter: AgentAdapter;
  scope: SessionScope;
  wipLimit: number;
  /** Status whose entry dispatches a run (c0099 config; default `ready`). */
  trigger?: string;
  /** Permission posture for headless agent runs (adapter-specific; see
   *  `RunRequest.permissionMode`). Undefined → the CLI's own default. */
  permissionMode?: string;
  spawn: Spawner;
  /** c0102: how to launch the `add_question` MCP server. The runner stamps the
   *  run's card id into its env, which is what scopes the tool. */
  askServer?: AskServerSpec;
  /** Re-read the board from disk (to classify an exit, drain the queue). */
  reload: () => BoardModel;
  /** Write a card file, given its **absolute** path. Injected so tests can
   *  observe *where* the write lands; defaults to an atomic node:fs write. */
  writeCard?: (absPath: string, raw: string) => void;
  /** Published whenever the set of active runs changes. */
  onRuns: (runs: RunState[]) => void;
  /** Initial session map; defaults to empty. */
  sessions?: SessionMap;
  /** Persist the session map after a new session is recorded. */
  persistSessions?: (map: SessionMap) => void;
  log?: (message: string) => void;
  /** c0104: terminal verbosity for rendered agent output (default `normal`). */
  level?: Level;
  /** c0104: where a rendered stream line goes (default `console.log`). */
  emit?: (line: string) => void;
  /** c0104: persist one parsed event to the runs.log transcript. No-op if
   *  unset (tests that don't care about the transcript). */
  appendRunLog?: (cardId: string, event: AgentEvent) => void;
  /** c0109: coalescing window (ms) for activity-driven state writes. Default
   *  ~1s — a glimpse tolerates a second of lag. */
  activityThrottleMs?: number;
  /** c0109: clock + timer surface for the activity throttle. Injected so tests
   *  drive it deterministically; defaults to real time. */
  now?: () => number;
  scheduler?: Scheduler;
}

interface ActiveRun {
  sessionId: string;
  phase: RunPhase;
  /** Latest per-run usage from the piped stream (c0104), once reported. */
  usage?: RunUsage;
  /** Latest tool call from the piped stream (c0109), once one has been seen. */
  activity?: Activity;
  /** Model the backend reported using (c0112), once it has said so. */
  model?: string;
}

export class Runner {
  private readonly active = new Map<string, ActiveRun>();
  /** Card id → the last held-back reason logged for it (i0119), so a reason is
   *  announced on change instead of on every watcher tick. */
  private heldBack = new Map<string, string>();
  private sessions: SessionMap;
  /** c0109: coalesces activity-driven state writes to ~1s, however fast the
   *  agent emits tool calls. Lifecycle changes publish immediately (bypass it). */
  private readonly activityThrottle: Throttle;

  constructor(private readonly opts: RunnerOptions) {
    this.sessions = opts.sessions ?? {};
    this.activityThrottle = new Throttle(
      opts.activityThrottleMs ?? 1000,
      opts.now,
      opts.scheduler,
    );
  }

  /**
   * Reconcile against a fresh board load: resume answered parked runs, then
   * dispatch ready cards up to the WIP budget (draining the queue as slots
   * free). Takes only the current board — c0102 moved the resume trigger from a
   * model diff to the `awaiting` marker, which is durable on disk, so a
   * companion that was down while the human answered still sees it on startup.
   */
  sync(next: BoardModel): void {
    for (const card of cardsAnswered(next)) this.maybeResume(card, next.config);
    const { dispatch, queued, blocked } = planDispatch(
      next,
      [...this.active.keys()],
      this.opts.wipLimit,
      this.opts.trigger ?? READY,
    );
    this.reportHeldBack(queued, blocked);
    for (const card of dispatch) this.start(card, false);
    this.publish();
  }

  /**
   * Say why a card in the trigger status is not running (i0119). Without this
   * the companion refuses silently, which from outside is indistinguishable
   * from a companion that failed to start. `sync` runs on every watcher tick,
   * so each card's reason is logged when it changes, not on every pass.
   */
  private reportHeldBack(queued: Card[], blocked: BlockedCard[]): void {
    const reasons = new Map<string, string>();
    for (const { card, missing } of blocked) {
      reasons.set(card.id, `waiting on ${missing.join(", ")} (not done)`);
    }
    for (const card of queued) {
      reasons.set(card.id, `at the in-progress WIP limit (${this.opts.wipLimit})`);
    }
    for (const [cardId, reason] of reasons) {
      if (this.heldBack.get(cardId) !== reason) this.log(`${cardId} held: ${reason}`);
    }
    this.heldBack = reasons;
  }

  /**
   * Resume a card whose open turn just became answered. The trigger is the card
   * file, not an in-memory flag — answering must work even after the companion
   * restarted (the parked run is gone but the session persists), and on a cold
   * start for a turn left answered-but-unarchived. Guarded so it only continues
   * a dialogue the companion actually owns (a session exists) and is not
   * already running.
   */
  private maybeResume(card: Card, config: BoardConfig): void {
    if (this.active.get(card.id)?.phase === "running") return;
    const { sessionId } = resolveSession(this.sessions, card, this.opts.scope);
    if (sessionId === null) return; // never started by us — don't dispatch
    // Clear before dispatching: the marker is the resume trigger, so leaving it
    // set would re-fire the same resume on every subsequent sync.
    this.clearAwaiting(card, config);
    this.start(card, true);
  }

  /** Drop `awaiting: answered` from the card file. The one card write the
   *  companion makes — it owns the marker half of the Q&A protocol (c0102). */
  private clearAwaiting(card: Card, config: BoardConfig): void {
    try {
      const { raw } = withAwaitingCleared(card, todayIsoDate(), config);
      const write = this.opts.writeCard ?? writeCardAtomic;
      // card.path is relative to the .gello root, never to the agent's cwd
      write(join(this.opts.boardRoot, card.path), raw);
    } catch (error) {
      this.log(`could not clear awaiting on ${card.id}: ${(error as Error).message}`);
    }
  }

  /** Active runs as published run states. Activity is carried only while a run
   *  is `running` — a parked/done run's last tool call is meaningless, and the
   *  needs-input badge already speaks for a parked one (c0109). */
  runs(): RunState[] {
    return [...this.active].map(([cardId, r]) => ({
      cardId,
      phase: r.phase,
      ...(r.usage ? { usage: r.usage } : {}),
      ...(r.phase === "running" && r.activity ? { activity: r.activity } : {}),
      ...(r.model ? { model: r.model } : {}),
    }));
  }

  private start(card: Card, answered: boolean): void {
    const { key, sessionId } = resolveSession(this.sessions, card, this.opts.scope);
    // An existing session id must be *resumed*, not recreated — some backends
    // (claude) error on `--session-id` when the id already exists. This holds
    // both for an answered parked turn and for a re-dispatch after the
    // companion restarted with a persisted session map. `answered` only
    // changes the prompt wording.
    const resume = sessionId !== null;
    const id = sessionId ?? newSessionId();
    if (!resume) {
      this.sessions = recordSession(this.sessions, key, id);
      this.opts.persistSessions?.(this.sessions);
    }
    const spec = this.opts.adapter.build({
      sessionId: id,
      prompt: buildTaskPrompt(card, answered),
      mode: "print",
      resume,
      permissionMode: this.opts.permissionMode,
      askServer: this.opts.askServer && {
        ...this.opts.askServer,
        env: { ...this.opts.askServer.env, GELLO_CARD_ID: card.id },
      },
    });
    this.active.set(card.id, { sessionId: id, phase: "running" });
    this.log(`${card.id} → ${resume ? "resume" : "run"} (session ${id})`);
    // The ask surfaces (`add_question`, `gello ask`) read the card from here —
    // it is what stops an agent parking a question on an unrelated card (c0102).
    const proc = this.opts.spawn(spec, this.opts.cwd, { GELLO_CARD_ID: card.id });
    // c0104: parse the piped stdout into neutral events — render per the level,
    // record every event to the transcript, and keep the latest usage so the
    // run's state entry can carry its tokens/cost.
    const sink = new StreamSink(
      card.id,
      this.opts.level ?? "normal",
      this.opts.adapter.stream.parse,
      this.opts.emit ?? ((line) => console.log(line)),
      this.opts.appendRunLog ?? (() => {}),
      (activity) => this.recordActivity(card.id, activity),
      (model) => this.recordModel(card.id, model),
    );
    proc.onStdout?.((chunk) => sink.feed(chunk));
    proc.onExit((code) => {
      sink.end();
      this.handleExit(card.id, code, sink.usage());
    });
  }

  /** Record the run's latest tool call and publish it — throttled, so a fast
   *  stream of tool calls rewrites the state file at most ~once a second (c0109). */
  private recordActivity(cardId: string, activity: Activity): void {
    const run = this.active.get(cardId);
    if (!run) return;
    run.activity = activity;
    this.activityThrottle.trigger(() => this.publish());
  }

  /** Record which model the run reports using (c0112). Published through the
   *  same coalescing window as activity — it arrives early and rarely changes. */
  private recordModel(cardId: string, model: string): void {
    const run = this.active.get(cardId);
    if (!run || run.model === model) return;
    run.model = model;
    this.activityThrottle.trigger(() => this.publish());
  }

  private handleExit(cardId: string, code: number | null, usage?: RunUsage): void {
    const run = this.active.get(cardId);
    if (!run) return;

    let card: Card | undefined;
    try {
      card = byId(this.opts.reload()).get(cardId);
    } catch (error) {
      this.log(`reload after ${cardId} exit failed: ${(error as Error).message}`);
    }
    const phase = classifyExit(card, code);

    if (phase === "waiting-for-input") {
      // A parked run stays in the state file — carry its usage so the popover
      // can show what the turn cost while it waits on the human.
      this.active.set(cardId, { ...run, phase, usage: usage ?? run.usage });
      this.log(`${cardId} parked → waiting for input`);
    } else {
      this.active.delete(cardId);
      if (phase === "error") {
        // The card is left exactly as the agent left it — recoverable; the
        // companion never rewrites it. The error surfaces via the state file.
        this.log(`${cardId} run errored (exit ${code}); card left as-is`);
      } else {
        this.log(`${cardId} done`);
      }
    }
    this.publish();
  }

  private publish(): void {
    this.opts.onRuns(this.runs());
  }

  private log(message: string): void {
    this.opts.log?.(message);
  }
}
