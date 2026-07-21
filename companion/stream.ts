// gello-companion run observability (c0104): the backend-neutral event stream
// and how it renders. The companion pipes the agent's stdout (no longer
// `inherit`), an adapter parses it into these events, and the companion decides
// what to show at the configured verbosity.
//
// Three surfaces consume the events: the terminal (this file's `renderEvent`,
// level-gated and card-id prefixed so two concurrent runs stay readable), the
// per-run usage in the state file (`StreamSink.usage`), and a persisted
// `runs.log` transcript (every event, via the sink's log callback).

/** Verbosity ladder (c0104). `normal` is the default — tool calls and a
 *  token/cost summary without opting in. */
export type Level = "quiet" | "normal" | "verbose";

export const LEVELS: Level[] = ["quiet", "normal", "verbose"];

/** Token/cost accounting for one run, mapped from the backend's final event
 *  (claude's `result`). All optional — a backend without a figure omits it. */
export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  totalCostUsd?: number;
  numTurns?: number;
  durationMs?: number;
  /** Denied tool calls (claude `result.permission_denials`). Surfacing this at
   *  `normal` would have made the c0097 headless-permission bug obvious. */
  permissionDenials?: number;
}

/** One backend-neutral thing that happened during a run. An adapter's parser
 *  maps its backend's output onto this closed set; the rest of the companion
 *  never sees a backend's schema. */
export type AgentEvent =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; arg?: string }
  | { kind: "usage"; usage: RunUsage }
  /** c0112: which model the backend is actually running, for the TUI header. */
  | { kind: "model"; model: string };

/** What the agent is doing right now (c0109): the latest tool call, structured.
 *  The companion publishes this in the state file; the app phrases it into a
 *  card line (tool → verb, path → basename). */
export interface Activity {
  name: string;
  arg?: string;
}

const RANK: Record<Level, number> = { quiet: 0, normal: 1, verbose: 2 };

const MAX_ARG = 120;

/** Collapse a tool argument to one readable, bounded line. */
function oneLine(arg: string): string {
  const flat = arg.replace(/\s+/g, " ").trim();
  return flat.length > MAX_ARG ? `${flat.slice(0, MAX_ARG)}…` : flat;
}

/** Human summary of a run's usage (without the card-id prefix). */
export function formatUsage(u: RunUsage): string {
  const parts = [`${u.inputTokens} in / ${u.outputTokens} out tokens`];
  if (typeof u.totalCostUsd === "number") parts.push(`$${u.totalCostUsd.toFixed(4)}`);
  if (typeof u.numTurns === "number") parts.push(`${u.numTurns} turns`);
  if (typeof u.durationMs === "number") parts.push(`${(u.durationMs / 1000).toFixed(1)}s`);
  if (u.permissionDenials && u.permissionDenials > 0) {
    parts.push(`${u.permissionDenials} permission denials`);
  }
  return parts.join(", ");
}

/**
 * The terminal lines for one event at a given level, each prefixed with the
 * card id so interleaved output from concurrent runs stays attributable.
 * `quiet` returns nothing (only the companion's own lifecycle lines show);
 * `normal` shows tool calls and the usage summary; `verbose` adds assistant
 * text.
 */
export function renderEvent(level: Level, cardId: string, event: AgentEvent): string[] {
  const prefix = `[${cardId}] `;
  switch (event.kind) {
    case "tool":
      if (RANK[level] < RANK.normal) return [];
      return [`${prefix}→ ${event.name}${event.arg ? `(${oneLine(event.arg)})` : ""}`];
    case "usage":
      if (RANK[level] < RANK.normal) return [];
      return [`${prefix}✓ ${formatUsage(event.usage)}`];
    case "text":
      if (RANK[level] < RANK.verbose) return [];
      return event.text
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map((l) => `${prefix}${l}`);
    case "model":
      // c0112: header data, not a log line. Rendering nothing keeps both the
      // terminal and the runs.log transcript exactly as they were.
      return [];
  }
}

/**
 * Reassembles complete lines from arbitrarily-chunked stdout. A piped stream
 * splits NDJSON mid-line, so a parser must never see a half line. `push`
 * returns the lines completed by a chunk; `flush` returns any trailing partial
 * line at end-of-stream (once).
 */
export class LineBuffer {
  private held = "";

  push(chunk: string): string[] {
    this.held += chunk;
    const parts = this.held.split("\n");
    this.held = parts.pop() ?? ""; // last element is the incomplete tail
    return parts.map((l) => l.replace(/\r$/, ""));
  }

  flush(): string {
    const rest = this.held.replace(/\r$/, "");
    this.held = "";
    return rest;
  }
}

/**
 * Ties one run's piped stdout to the three surfaces: it buffers chunks into
 * lines, parses each with the adapter's parser, renders per the level (to
 * `emit`), records every event (to `logEvent`, the runs.log transcript), and
 * keeps the latest usage so the runner can publish it. A malformed line yields
 * no events (the parser swallows it), so bad output is never fatal to the run.
 */
export class StreamSink {
  private readonly buffer = new LineBuffer();
  private lastUsage: RunUsage | undefined;
  private lastActivity: Activity | undefined;
  private lastModel: string | undefined;

  constructor(
    private readonly cardId: string,
    private readonly level: Level,
    private readonly parse: (line: string) => AgentEvent[],
    /** c0112: the run's card is passed alongside the line so a caller can route
     *  it into that card's own pane instead of one merged stream. */
    private readonly emit: (line: string, cardId: string) => void,
    private readonly logEvent: (cardId: string, event: AgentEvent) => void,
    /** c0109: called on each tool call with the run's new activity. Not
     *  level-gated — the card line shows at every verbosity. */
    private readonly onActivity?: (activity: Activity) => void,
    /** c0112: called when the run reports which model it is using. */
    private readonly onModel?: (model: string) => void,
  ) {}

  feed(chunk: string): void {
    for (const line of this.buffer.push(chunk)) this.handle(line);
  }

  /** Drain the trailing unterminated line when the process exits. */
  end(): void {
    const rest = this.buffer.flush();
    if (rest) this.handle(rest);
  }

  usage(): RunUsage | undefined {
    return this.lastUsage;
  }

  /** The latest tool call, once one has been seen (c0109). */
  activity(): Activity | undefined {
    return this.lastActivity;
  }

  /** The model this run reports using, once seen (c0112). */
  model(): string | undefined {
    return this.lastModel;
  }

  private handle(line: string): void {
    for (const event of this.parse(line)) {
      if (event.kind === "usage") this.lastUsage = event.usage;
      if (event.kind === "model") {
        this.lastModel = event.model;
        this.onModel?.(event.model);
      }
      if (event.kind === "tool") {
        this.lastActivity = event.arg !== undefined
          ? { name: event.name, arg: event.arg }
          : { name: event.name };
        this.onActivity?.(this.lastActivity);
      }
      this.logEvent(this.cardId, event);
      for (const out of renderEvent(this.level, this.cardId, event)) this.emit(out, this.cardId);
    }
  }
}
