import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  imageDataUrl,
  loadBoardFromDisk,
  migrateBoard,
  readFileRaw,
  watchBoard,
} from "./board-io";

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
          { path: "board.yaml", content: "columns: [inbox, backlog, ready]\n" },
          { path: "cards/c001-first.md", content: CARD },
        ];
      }
      throw new Error(`unexpected command ${String(command)}`);
    });

    const loaded = await loadBoardFromDisk();

    expect(loaded).not.toBeNull();
    expect(loaded?.root).toBe("/repo/.gello");
    expect(loaded?.model.config.columns).toEqual(["inbox", "backlog", "ready"]);
    expect(loaded?.model.cards.map((c) => c.id)).toEqual(["c001"]);
    expect(loaded?.legacy).toBe(false);
  });

  it("c0079: flags a legacy milestone-format board", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "find_board_root") return "/repo/.gello";
      if (command === "read_board_files") {
        return [
          { path: "milestones/m01-x/milestone.md", content: "---\nid: m01\ntitle: X\n---\n" },
        ];
      }
      throw new Error(`unexpected command ${String(command)}`);
    });

    const loaded = await loadBoardFromDisk();

    expect(loaded?.legacy).toBe(true);
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

describe("migrateBoard (c0079)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it("writes the new epic tree first, then removes the old milestones tree", async () => {
    await migrateBoard("/repo/.gello", {
      writes: [
        { path: "epics/e01-x/epic.md", content: "---\nid: e01\n---\n" },
        { path: "epics/e01-x/c001-y.md", content: "---\nid: c001\nepic: e01\n---\n" },
      ],
      deletes: ["milestones/m01-x/milestone.md", "milestones/m01-x/c001-y.md"],
    });

    // new files written with absolute paths, via the mkdir-p writer
    expect(invokeMock).toHaveBeenCalledWith("write_new_files", {
      files: [
        { path: "/repo/.gello/epics/e01-x/epic.md", content: "---\nid: e01\n---\n" },
        {
          path: "/repo/.gello/epics/e01-x/c001-y.md",
          content: "---\nid: c001\nepic: e01\n---\n",
        },
      ],
    });
    // the old tree is removed wholesale, only after the writes
    expect(invokeMock).toHaveBeenCalledWith("remove_dir", {
      path: "/repo/.gello/milestones",
    });
    const writeOrder = invokeMock.mock.calls.findIndex((c) => c[0] === "write_new_files");
    const removeOrder = invokeMock.mock.calls.findIndex((c) => c[0] === "remove_dir");
    expect(writeOrder).toBeLessThan(removeOrder);
  });

  it("migrateLegacyBoard reads disk bytes, plans, and applies the rewrite", async () => {
    const { migrateLegacyBoard } = await import("./board-io");
    invokeMock.mockImplementation(async (command) => {
      if (command === "read_board_files") {
        return [
          { path: "milestones/m01-x/milestone.md", content: "---\nid: m01\ntitle: X\n---\n" },
          {
            path: "milestones/m01-x/c001-y.md",
            content: "---\nid: c001\ntitle: Y\nmilestone: m01\n---\n",
          },
        ];
      }
      return undefined;
    });

    await migrateLegacyBoard("/repo/.gello");

    expect(invokeMock).toHaveBeenCalledWith("write_new_files", {
      files: [
        {
          path: "/repo/.gello/epics/e01-x/epic.md",
          content: "---\nid: e01\ntitle: X\n---\n",
        },
        {
          path: "/repo/.gello/epics/e01-x/c001-y.md",
          content: "---\nid: c001\ntitle: Y\nepic: e01\n---\n",
        },
      ],
    });
    expect(invokeMock).toHaveBeenCalledWith("remove_dir", {
      path: "/repo/.gello/milestones",
    });
  });

  it("does not remove the old tree if the write fails", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "write_new_files") throw new Error("disk full");
      return undefined;
    });

    await expect(
      migrateBoard("/repo/.gello", {
        writes: [{ path: "epics/e01-x/epic.md", content: "x" }],
        deletes: ["milestones/m01-x/milestone.md"],
      }),
    ).rejects.toThrow("disk full");
    expect(invokeMock).not.toHaveBeenCalledWith("remove_dir", expect.anything());
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

describe("imageDataUrl (c047)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("builds a data URL with the mime type inferred from the extension", async () => {
    invokeMock.mockResolvedValueOnce("aWJhc2U2NA==");

    const url = await imageDataUrl("/repo/.gello/assets/board/bg.jpg");

    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("read_file_base64", {
      path: "/repo/.gello/assets/board/bg.jpg",
    });
    expect(url).toBe("data:image/jpeg;base64,aWJhc2U2NA==");
  });

  it("supports png/webp/gif and falls back to png for unknown extensions", async () => {
    invokeMock.mockResolvedValue("eA==");

    expect(await imageDataUrl("/x/a.png")).toContain("data:image/png;base64,");
    expect(await imageDataUrl("/x/a.webp")).toContain("data:image/webp;base64,");
    expect(await imageDataUrl("/x/a.gif")).toContain("data:image/gif;base64,");
    expect(await imageDataUrl("/x/a.unknown")).toContain("data:image/png;base64,");
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
