import { describe, expect, it } from "vitest";
import { Throttle, type Scheduler } from "./throttle.ts";

/** A manual clock + scheduler: time only advances when the test says so, and
 *  a scheduled run fires only when its due time is reached via `advance`. */
function fakeClock() {
  let now = 0;
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
    /** Advance time, firing every scheduled run whose due time has passed. */
    advance(ms: number) {
      now += ms;
      for (const [id, task] of [...pending]) {
        if (task.at <= now) {
          pending.delete(id);
          task.fn();
        }
      }
    },
    pendingCount: () => pending.size,
  };
}

describe("Throttle", () => {
  it("runs the first trigger immediately (leading edge)", () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock.now, clock.scheduler);
    let runs = 0;
    t.trigger(() => runs++);
    expect(runs).toBe(1);
  });

  it("coalesces a burst within the window into one trailing run", () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock.now, clock.scheduler);
    const seen: number[] = [];
    t.trigger(() => seen.push(1)); // leading, fires now
    t.trigger(() => seen.push(2)); // within window → schedule trailing
    t.trigger(() => seen.push(3)); // still within window → replaces trailing fn
    expect(seen).toEqual([1]); // only the leading has fired
    clock.advance(1000); // window elapses → the (latest) trailing fires once
    expect(seen).toEqual([1, 3]);
  });

  it("allows another leading run once the window has fully elapsed", () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock.now, clock.scheduler);
    let runs = 0;
    t.trigger(() => runs++); // leading
    clock.advance(1000); // window passes with no further triggers
    t.trigger(() => runs++); // a fresh window → immediate again
    expect(runs).toBe(2);
  });

  it("bounds writes to about one per window under a fast stream", () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock.now, clock.scheduler);
    let runs = 0;
    // 100 triggers spread over 3s, 30ms apart.
    for (let i = 0; i < 100; i++) {
      t.trigger(() => runs++);
      clock.advance(30);
    }
    // leading + one trailing per elapsed window — not one per trigger.
    expect(runs).toBeGreaterThan(0);
    expect(runs).toBeLessThanOrEqual(5);
  });

  it("cancel drops a queued trailing run and clears its timer", () => {
    const clock = fakeClock();
    const t = new Throttle(1000, clock.now, clock.scheduler);
    let runs = 0;
    t.trigger(() => runs++); // leading
    t.trigger(() => runs++); // schedules a trailing
    expect(clock.pendingCount()).toBe(1);
    t.cancel();
    expect(clock.pendingCount()).toBe(0);
    clock.advance(1000);
    expect(runs).toBe(1); // the trailing was dropped
  });
});
