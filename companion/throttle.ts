// gello-companion write throttle (c0109): bound how often a fast-changing
// signal is published. The agent's activity (its latest tool call) can change
// many times a second; the desktop app only needs a glimpse a second or two
// old. This coalesces those updates into at most one write per window.

export type TimerId = ReturnType<typeof setTimeout>;

/** The timer surface the throttle needs. Injected so tests drive it with a
 *  manual clock instead of real time. */
export interface Scheduler {
  set(fn: () => void, ms: number): TimerId;
  clear(id: TimerId): void;
}

export const realScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id),
};

/**
 * Leading + trailing throttle. The first `trigger` runs `fn` at once (the
 * glimpse appears without lag); further triggers inside the window coalesce
 * into a single trailing run at the window's end, always carrying the latest
 * `fn`. So however fast the triggers arrive, `fn` runs at most about once per
 * `intervalMs`.
 */
export class Throttle {
  private last = -Infinity;
  private timer: TimerId | undefined;
  private pending: (() => void) | undefined;

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = () => Date.now(),
    private readonly scheduler: Scheduler = realScheduler,
  ) {}

  trigger(fn: () => void): void {
    if (this.timer !== undefined) {
      this.pending = fn; // a trailing run is already queued — keep the latest fn
      return;
    }
    const elapsed = this.now() - this.last;
    if (elapsed >= this.intervalMs) {
      this.last = this.now();
      fn();
      return;
    }
    this.pending = fn;
    this.timer = this.scheduler.set(() => this.fire(), this.intervalMs - elapsed);
  }

  private fire(): void {
    this.timer = undefined;
    this.last = this.now();
    const fn = this.pending;
    this.pending = undefined;
    fn?.();
  }

  /** Drop any queued trailing run (e.g. on shutdown). */
  cancel(): void {
    if (this.timer !== undefined) {
      this.scheduler.clear(this.timer);
      this.timer = undefined;
      this.pending = undefined;
    }
  }
}
