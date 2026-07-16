import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { FsWriteError, writeFileAtomic } from "./fs";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);

describe("writeFileAtomic", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("invokes the Rust command with path and contents", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await writeFileAtomic("/repo/.gello/inbox/c001-x.md", "---\nid: c001\n---\n");

    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("write_file_atomic", {
      path: "/repo/.gello/inbox/c001-x.md",
      contents: "---\nid: c001\n---\n",
    });
  });

  it("wraps a structured Rust error into a typed FsWriteError", async () => {
    invokeMock.mockRejectedValueOnce({
      kind: "NotFound",
      path: "/repo/.gello/nope.md",
      message: "No such file or directory (os error 2)",
    });

    const error = await writeFileAtomic("/repo/.gello/nope.md", "x").catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(FsWriteError);
    const fsError = error as FsWriteError;
    expect(fsError.kind).toBe("NotFound");
    expect(fsError.path).toBe("/repo/.gello/nope.md");
    expect(fsError.message).toContain("os error 2");
    expect(fsError.message).toContain("/repo/.gello/nope.md");
  });

  it("wraps non-structured failures too, keeping the requested path", async () => {
    invokeMock.mockRejectedValueOnce("command not allowed");

    const error = await writeFileAtomic("/x.md", "y").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FsWriteError);
    const fsError = error as FsWriteError;
    expect(fsError.kind).toBe("Unknown");
    expect(fsError.path).toBe("/x.md");
    expect(fsError.message).toContain("command not allowed");
  });
});
