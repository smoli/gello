import { describe, expect, it } from "vitest";
import { readRawOrNull } from "./safe-read";

describe("readRawOrNull", () => {
  it("returns the file content on a successful read", async () => {
    expect(await readRawOrNull(async () => "hello", "/x")).toBe("hello");
  });

  it("returns null when the read rejects", async () => {
    await expect(
      readRawOrNull(() => Promise.reject(new Error("gone")), "/x"),
    ).resolves.toBeNull();
  });

  it("returns null, never throwing, when the read returns nothing (i0036)", async () => {
    // A reset Vitest mock returns `undefined`, not a promise — the old inline
    // `read(path).catch(...)` in reconcile blew up here and rejected into the
    // void, exiting the suite non-zero.
    const read = (() => undefined) as unknown as (p: string) => Promise<string>;
    await expect(readRawOrNull(read, "/x")).resolves.toBeNull();
  });
});
