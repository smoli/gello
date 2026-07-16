import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { loadBoardFromDisk, readFileRaw, watchBoard } from "./board-io";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);

const CARD = `---\nid: c001\ntitle: First\nstatus: ready\n---\nbody\n`;

describe("loadBoardFromDisk", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("finds the root, reads its files, and returns the parsed model", async () => {
    invokeMock.mockImplementation(async (command, args) => {
      if (command === "find_board_root") return "/repo/.gello";
      if (command === "read_board_files") {
        expect(args).toEqual({ root: "/repo/.gello" });
        return [
          { path: "board.yaml", content: "columns: [backlog, ready]\n" },
          { path: "inbox/c001-first.md", content: CARD },
        ];
      }
      throw new Error(`unexpected command ${String(command)}`);
    });

    const loaded = await loadBoardFromDisk();

    expect(loaded).not.toBeNull();
    expect(loaded?.root).toBe("/repo/.gello");
    expect(loaded?.model.config.columns).toEqual(["backlog", "ready"]);
    expect(loaded?.model.inbox.map((c) => c.id)).toEqual(["c001"]);
  });

  it("returns null when no board root exists", async () => {
    invokeMock.mockResolvedValueOnce(null);

    expect(await loadBoardFromDisk()).toBeNull();
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("find_board_root");
  });

  it("returns null when not running inside Tauri (invoke unavailable)", async () => {
    invokeMock.mockRejectedValueOnce(new Error("window.__TAURI_INTERNALS__ missing"));

    expect(await loadBoardFromDisk()).toBeNull();
  });
});

describe("watchBoard", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it("subscribes to change events before starting the Rust watcher", async () => {
    const unlisten = vi.fn();
    let handler: ((event: { payload: string[] }) => void) | null = null;
    listenMock.mockImplementation(async (_name, callback) => {
      handler = callback as typeof handler;
      return unlisten;
    });
    invokeMock.mockResolvedValueOnce(undefined);
    const onChange = vi.fn();

    const stop = await watchBoard("/repo/.gello", onChange);

    expect(listenMock).toHaveBeenCalledExactlyOnceWith(
      "board-files-changed",
      expect.any(Function),
    );
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("watch_board", {
      root: "/repo/.gello",
    });
    // both calls happened; listen strictly first (no missed events)
    expect(listenMock.mock.invocationCallOrder[0]).toBeLessThan(
      invokeMock.mock.invocationCallOrder[0],
    );

    handler!({ payload: ["inbox/c001-x.md"] });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["inbox/c001-x.md"]);

    stop();
    expect(unlisten).toHaveBeenCalled();
  });
});

describe("readFileRaw", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("reads one file's current content by absolute path", async () => {
    invokeMock.mockResolvedValueOnce("---\nid: c001\n---\nx\n");

    expect(await readFileRaw("/repo/.gello/inbox/c001.md")).toBe(
      "---\nid: c001\n---\nx\n",
    );
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("read_file", {
      path: "/repo/.gello/inbox/c001.md",
    });
  });

  it("propagates read failures", async () => {
    invokeMock.mockRejectedValueOnce({ kind: "NotFound", message: "gone" });

    await expect(readFileRaw("/x.md")).rejects.toBeTruthy();
  });
});
