import { describe, expect, it, vi } from "vitest";
import {
  createSerialQueue,
  fitBox,
  shrinkToThumbnail,
  THUMB_MAX_PX,
  type Decoded,
} from "./thumbnail";

describe("fitBox (i0179)", () => {
  it("scales a landscape source down to the max on its long edge", () => {
    expect(fitBox({ width: 3024, height: 1964 }, 512)).toEqual({
      width: 512,
      height: 333,
    });
  });

  it("scales a portrait source down to the max on its long edge", () => {
    expect(fitBox({ width: 926, height: 1271 }, 512)).toEqual({
      width: 373,
      height: 512,
    });
  });

  it("never upscales a source that already fits", () => {
    expect(fitBox({ width: 138, height: 48 }, 512)).toEqual({
      width: 138,
      height: 48,
    });
  });

  it("keeps a square square", () => {
    expect(fitBox({ width: 1000, height: 1000 }, 512)).toEqual({
      width: 512,
      height: 512,
    });
  });

  it("keeps an extreme aspect ratio at least one pixel on the short edge", () => {
    // 2511x496 is a real board asset; 3000x2 is the degenerate case rounding
    // would otherwise take to zero, which no canvas accepts
    expect(fitBox({ width: 2511, height: 496 }, 512)).toEqual({
      width: 512,
      height: 101,
    });
    expect(fitBox({ width: 3000, height: 2 }, 512)).toEqual({
      width: 512,
      height: 1,
    });
  });

  it("treats a zero-sized source as nothing to draw", () => {
    expect(fitBox({ width: 0, height: 0 }, 512)).toEqual({ width: 0, height: 0 });
  });
});

/** A decoded stand-in that records what it was asked to encode and released. */
function fakeDecoded(
  width: number,
  height: number,
  encode: (size: { width: number; height: number }) => string | null = () => "data:small",
): Decoded & { released: number; encoded: { width: number; height: number }[] } {
  const calls: { width: number; height: number }[] = [];
  return {
    width,
    height,
    encoded: calls,
    released: 0,
    encode(size) {
      calls.push(size);
      return encode(size);
    },
    release() {
      this.released += 1;
    },
  };
}

describe("shrinkToThumbnail (i0179)", () => {
  it("encodes at the fitted size and returns the small data URL", async () => {
    const decoded = fakeDecoded(3024, 1964);
    const url = await shrinkToThumbnail("data:huge", 512, async () => decoded);

    expect(url).toBe("data:small");
    expect(decoded.encoded).toEqual([{ width: 512, height: 333 }]);
  });

  it("releases the full-size bitmap once the thumbnail is drawn", async () => {
    const decoded = fakeDecoded(3024, 1964);
    await shrinkToThumbnail("data:huge", 512, async () => decoded);

    expect(decoded.released).toBe(1);
  });

  it("still releases the full-size bitmap when encoding fails", async () => {
    const decoded = fakeDecoded(3024, 1964, () => {
      throw new Error("no 2d context");
    });
    const url = await shrinkToThumbnail("data:huge", 512, async () => decoded);

    expect(url).toBeNull();
    expect(decoded.released).toBe(1);
  });

  it("is null when encoding yields nothing", async () => {
    const decoded = fakeDecoded(10, 10, () => null);
    expect(await shrinkToThumbnail("data:huge", 512, async () => decoded)).toBeNull();
  });

  it("is null when the image cannot be decoded", async () => {
    const url = await shrinkToThumbnail("data:broken", 512, async () => {
      throw new Error("decode failed");
    });
    expect(url).toBeNull();
  });

  it("is null for a source with no pixels, without asking for an encode", async () => {
    const decoded = fakeDecoded(0, 0);
    expect(await shrinkToThumbnail("data:empty", 512, async () => decoded)).toBeNull();
    expect(decoded.encoded).toEqual([]);
    expect(decoded.released).toBe(1);
  });

  it("caps a board thumbnail well below a screenshot's own size by default", () => {
    // the guard on the constant itself: a card front is ~260 CSS px wide, so a
    // 2x display never needs more than this
    expect(THUMB_MAX_PX).toBeLessThanOrEqual(512);
  });
});

describe("createSerialQueue (i0179)", () => {
  it("holds the next job until the running one settles, so one bitmap is alive at a time", async () => {
    const queue = createSerialQueue();
    const running: string[] = [];
    let releaseFirst = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const a = queue(async () => {
      running.push("a");
      await first;
      return "A";
    });
    const b = queue(async () => {
      running.push("b");
      return "B";
    });

    await Promise.resolve();
    expect(running).toEqual(["a"]);

    releaseFirst();
    expect(await a).toBe("A");
    expect(await b).toBe("B");
    expect(running).toEqual(["a", "b"]);
  });

  it("does not wedge when a job rejects", async () => {
    const queue = createSerialQueue();
    const failed = queue(async () => {
      throw new Error("boom");
    });

    await expect(failed).rejects.toThrow("boom");
    await expect(queue(async () => "next")).resolves.toBe("next");
  });

  it("gives every caller its own result", async () => {
    const queue = createSerialQueue();
    const jobs = [1, 2, 3].map((n) => queue(async () => n * 10));
    expect(await Promise.all(jobs)).toEqual([10, 20, 30]);
  });

  it("runs jobs in the order they were queued", async () => {
    const queue = createSerialQueue();
    const order: number[] = [];
    const jobs = [1, 2, 3].map((n) =>
      queue(async () => {
        order.push(n);
      }),
    );
    await Promise.all(jobs);
    expect(order).toEqual([1, 2, 3]);
  });

  it("keeps a synchronously-throwing job from wedging the queue too", async () => {
    const queue = createSerialQueue();
    const bad = vi.fn(() => {
      throw new Error("sync boom");
    });

    await expect(queue(bad as unknown as () => Promise<void>)).rejects.toThrow("sync boom");
    await expect(queue(async () => "after")).resolves.toBe("after");
  });
});
