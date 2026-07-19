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

import type { BoardModel } from "../src/lib/board.ts";
import type { Card } from "../src/lib/cards.ts";
import type { AgentAdapter, LaunchSpec } from "./adapters.ts";
import type { RunState } from "./core.ts";
import {
  resolveSession,
  recordSession,
  newSessionId,
  type SessionMap,
  type SessionScope,
} from "./sessions.ts";
import { parseOpenTurn, isOpenTurnAnswered, cardsAnswered } from "./qa.ts";

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

/** A ready card is dispatchable only when all its `depends` are `done`. */
function dependsSatisfied(index: Map<string, Card>, card: Card): boolean {
  return card.depends.every((id) => index.get(id)?.status === DONE);
}

export interface DispatchPlan {
  /** Ready cards to start now, in board order, within the WIP budget. */
  dispatch: Card[];
  /** Dispatchable-but-over-budget ready cards, waiting for a free slot. */
  queued: Card[];
}

/**
 * Decide which ready cards to run now. Candidates are `ready`, not already
 * active, and dependency-satisfied, taken in the board's manual order (c056);
 * the WIP budget (limit minus occupied slots) caps how many start — the rest
 * queue and drain on a later sync as slots free.
 */
export function planDispatch(
  model: BoardModel,
  activeCardIds: string[],
  wipLimit: number,
): DispatchPlan {
  const index = byId(model);
  const active = new Set(activeCardIds);
  const candidates = allCards(model)
    .filter((c) => c.status === READY && !active.has(c.id) && dependsSatisfied(index, c))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const budget = Math.max(0, wipLimit - occupiedSlots(model, activeCardIds));
  return { dispatch: candidates.slice(0, budget), queued: candidates.slice(budget) };
}

export type RunPhase = RunState["phase"];

/**
 * Classify a finished agent process. A non-zero exit is an error. A clean exit
 * that left a parked, unanswered open turn (c0096) means the agent is waiting
 * on the human; anything else is done.
 */
export function classifyExit(card: Card | undefined, code: number | null): RunPhase {
  if (code !== 0) return "error";
  if (card && parseOpenTurn(card.body).present && !isOpenTurnAnswered(card.body)) {
    return "waiting-for-input";
  }
  return "done";
}

/** The task prompt handed to the agent. Minimal here — the full convention is
 *  taught by the companion system prompt (c0099); this just points the agent
 *  at the card and the park protocol so a run is self-contained. */
export function buildTaskPrompt(card: Card, resuming: boolean): string {
  if (resuming) {
    return (
      `The human answered your open question on gello card ${card.id} ` +
      `(${card.path}). Read the answers in its "## Open question" section, ` +
      `archive that resolved turn to "## History", clear the awaiting marker, ` +
      `and continue the work.`
    );
  }
  return (
    `Work gello card ${card.id} — "${card.title}" (${card.path}). Follow the ` +
    `gello workflow in CLAUDE.md: set it in-progress, work test-first, keep ` +
    `Notes/Log current, and move it to review when the acceptance criteria ` +
    `pass. If you need a human decision, write it into the card's ` +
    `"## Open question" section and exit — the human answers there and you ` +
    `resume.`
  );
}

// --- the runner -------------------------------------------------------------

/** A spawned agent process, reduced to what the runner needs: an exit hook. */
export interface SpawnedRun {
  onExit(cb: (code: number | null) => void): void;
}

/** Launches an agent process from a spec. Real impl wraps `child_process`;
 *  tests pass a fake. */
export type Spawner = (spec: LaunchSpec, cwd: string) => SpawnedRun;

export interface RunnerOptions {
  /** Absolute `.gello` root (agent cwd + state location). */
  root: string;
  adapter: AgentAdapter;
  scope: SessionScope;
  wipLimit: number;
  spawn: Spawner;
  /** Re-read the board from disk (to classify an exit, drain the queue). */
  reload: () => BoardModel;
  /** Published whenever the set of active runs changes. */
  onRuns: (runs: RunState[]) => void;
  /** Initial session map; defaults to empty. */
  sessions?: SessionMap;
  /** Persist the session map after a new session is recorded. */
  persistSessions?: (map: SessionMap) => void;
  log?: (message: string) => void;
}

interface ActiveRun {
  sessionId: string;
  phase: RunPhase;
}

export class Runner {
  private readonly active = new Map<string, ActiveRun>();
  private sessions: SessionMap;

  constructor(private readonly opts: RunnerOptions) {
    this.sessions = opts.sessions ?? {};
  }

  /** Reconcile against a fresh board load: resume answered parked runs, then
   *  dispatch ready cards up to the WIP budget (draining the queue as slots
   *  free). */
  sync(prev: BoardModel | null, next: BoardModel): void {
    for (const card of cardsAnswered(prev, next)) {
      if (this.active.get(card.id)?.phase === "waiting-for-input") this.start(card, true);
    }
    const { dispatch } = planDispatch(next, [...this.active.keys()], this.opts.wipLimit);
    for (const card of dispatch) this.start(card, false);
    this.publish();
  }

  /** Active runs as published run states. */
  runs(): RunState[] {
    return [...this.active].map(([cardId, r]) => ({ cardId, phase: r.phase }));
  }

  private start(card: Card, resuming: boolean): void {
    const { key, sessionId } = resolveSession(this.sessions, card, this.opts.scope);
    const id = sessionId ?? newSessionId();
    if (!sessionId) {
      this.sessions = recordSession(this.sessions, key, id);
      this.opts.persistSessions?.(this.sessions);
    }
    const spec = this.opts.adapter.build({
      sessionId: id,
      prompt: buildTaskPrompt(card, resuming),
      mode: "print",
    });
    this.active.set(card.id, { sessionId: id, phase: "running" });
    this.log(`${card.id} → ${resuming ? "resume" : "run"} (session ${id})`);
    const proc = this.opts.spawn(spec, this.opts.root);
    proc.onExit((code) => this.handleExit(card.id, code));
  }

  private handleExit(cardId: string, code: number | null): void {
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
      this.active.set(cardId, { ...run, phase });
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
