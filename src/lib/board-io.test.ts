import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  boardExistsAt,
  imageDataUrl,
  imageThumbnail,
  loadBoardFromDisk,
  migrateBoard,
  readAfkFlag,
  readFileRaw,
  watchBoard,
  writeAfkFlag,
} from "./board-io";
import { decodeImage } from "./thumbnail-browser";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("./thumbnail-browser", () => ({ decodeImage: vi.fn() }));
const decodeMock = vi.mocked(decodeImage);
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

describe("boardExistsAt (c0146)", () => {
  beforeEach(() => invokeMock.mockReset());

  it("is true when a board root is found for the folder", async () => {
    invokeMock.mockResolvedValueOnce("/repo/.gello");
    expect(await boardExistsAt("/repo")).toBe(true);
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("find_board_root_at", {
      folder: "/repo",
    });
  });

  it("is false when the folder has no board (moved/deleted repo)", async () => {
    invokeMock.mockResolvedValueOnce(null);
    expect(await boardExistsAt("/gone")).toBe(false);
  });

  it("is false outside Tauri / on error", async () => {
    invokeMock.mockRejectedValueOnce(new Error("no invoke"));
    expect(await boardExistsAt("/x")).toBe(false);
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

  type Payload = { id: string; paths: string[] };

  /** Capture the event handler each watchBoard call subscribes with. */
  function captureHandlers(unlisten = vi.fn()) {
    const handlers: Array<(event: { payload: Payload }) => void> = [];
    listenMock.mockImplementation(async (_name, callback) => {
      handlers.push(callback as (event: { payload: Payload }) => void);
      return unlisten;
    });
    return handlers;
  }

  /** The watch id watchBoard passed on its `nth` (0-based) watch_board call. */
  function watchId(nth: number): string {
    const call = invokeMock.mock.calls.filter(([command]) => command === "watch_board")[nth];
    return (call[1] as { id: string }).id;
  }

  it("subscribes to change events before starting the Rust watcher", async () => {
    const unlisten = vi.fn();
    const handlers = captureHandlers(unlisten);
    invokeMock.mockResolvedValue(undefined);
    const onChange = vi.fn();

    const stop = await watchBoard("/repo/.gello", onChange);

    expect(listenMock).toHaveBeenCalledExactlyOnceWith(
      "board-files-changed",
      expect.any(Function),
    );
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("watch_board", {
      root: "/repo/.gello",
      id: watchId(0),
    });
    // both calls happened; listen strictly first (no missed events)
    expect(listenMock.mock.invocationCallOrder[0]).toBeLessThan(
      invokeMock.mock.invocationCallOrder[0],
    );

    handlers[0]({ payload: { id: watchId(0), paths: ["inbox/c001-x.md"] } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["inbox/c001-x.md"]);

    stop();
    expect(unlisten).toHaveBeenCalled();
  });

  // c0138: the activity view watches every selected board at once. The event
  // stream is one channel, so each watcher only takes the events carrying its
  // own id — otherwise every board would reconcile every other board's changes.
  it("delivers each board's changes only to the watcher that asked for them", async () => {
    const handlers = captureHandlers();
    invokeMock.mockResolvedValue(undefined);
    const onFirst = vi.fn();
    const onSecond = vi.fn();

    await watchBoard("/one/.gello", onFirst);
    await watchBoard("/two/.gello", onSecond);

    expect(watchId(0)).not.toBe(watchId(1));

    const event = { payload: { id: watchId(1), paths: ["cards/c002-y.md"] } };
    handlers[0](event);
    handlers[1](event);

    expect(onFirst).not.toHaveBeenCalled();
    expect(onSecond).toHaveBeenCalledExactlyOnceWith(["cards/c002-y.md"]);
  });

  it("stops the Rust watcher too, so a dropped project is no longer watched", async () => {
    const unlisten = vi.fn();
    captureHandlers(unlisten);
    invokeMock.mockResolvedValue(undefined);

    const stop = await watchBoard("/one/.gello", vi.fn());
    stop();

    expect(unlisten).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("unwatch_board", { id: watchId(0) });
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

// c0169: the app side of the AFK flag (c0162) — the toggle writes it, the
// title-bar control reflects what is on disk.
describe("the AFK flag (c0169)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("writes the on state atomically to .companion/afk.json", async () => {
    invokeMock.mockResolvedValue(undefined);

    await writeAfkFlag("/repo/.gello", true);

    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("write_file_atomic", {
      path: "/repo/.gello/.companion/afk.json",
      contents: '{\n  "afk": true\n}\n',
    });
  });

  it("writes the off state, so turning AFK off is a state the companion reads", async () => {
    invokeMock.mockResolvedValue(undefined);

    await writeAfkFlag("/repo/.gello", false);

    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("write_file_atomic", {
      path: "/repo/.gello/.companion/afk.json",
      contents: '{\n  "afk": false\n}\n',
    });
  });

  it("reads the current state back off disk", async () => {
    invokeMock.mockResolvedValueOnce('{"afk": true}\n');

    expect(await readAfkFlag("/repo/.gello")).toBe(true);
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("read_file", {
      path: "/repo/.gello/.companion/afk.json",
    });
  });

  it("reads as off when no flag file has ever been written", async () => {
    invokeMock.mockRejectedValueOnce({ kind: "NotFound", message: "gone" });

    expect(await readAfkFlag("/repo/.gello")).toBe(false);
  });
});

// i0179: the board-thumbnail read. The canvas/Image decode is a browser seam
// (thumbnail-browser.ts), stubbed here so the wiring — read the file, shrink it,
// one decode at a time — is assertable without a real webview.
describe("imageThumbnail (i0179)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    decodeMock.mockReset();
  });

  /** A decode stand-in that resolves when `settle` is called. */
  function pendingDecode(width: number, height: number, encoded: string) {
    let settle = () => {};
    const decoded = {
      width,
      height,
      encode: () => encoded,
      release: vi.fn(),
    };
    const promise = new Promise<typeof decoded>((resolve) => {
      settle = () => resolve(decoded);
    });
    return { promise, settle, decoded };
  }

  it("reads the image and returns a downscaled copy, not the full-size one", async () => {
    invokeMock.mockResolvedValueOnce("ZnVsbA==");
    const release = vi.fn();
    decodeMock.mockResolvedValueOnce({
      width: 3024,
      height: 1964,
      encode: (size) => `data:image/webp;base64,thumb-${size.width}x${size.height}`,
      release,
    });

    const url = await imageThumbnail("/repo/.gello/assets/i0133/image.png");

    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("read_file_base64", {
      path: "/repo/.gello/assets/i0133/image.png",
    });
    // the full-size data URL is what gets decoded, and only transiently
    expect(decodeMock).toHaveBeenCalledExactlyOnceWith("data:image/png;base64,ZnVsbA==");
    expect(url).toBe("data:image/webp;base64,thumb-512x333");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("decodes one image at a time, so a board of screenshots never holds them all", async () => {
    invokeMock.mockResolvedValue("ZnVsbA==");
    const first = pendingDecode(1000, 1000, "data:one");
    const second = pendingDecode(1000, 1000, "data:two");
    decodeMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const a = imageThumbnail("/repo/.gello/assets/a/image.png");
    const b = imageThumbnail("/repo/.gello/assets/b/image.png");

    // the second decode has not started while the first is still in flight
    await vi.waitFor(() => expect(decodeMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(decodeMock).toHaveBeenCalledTimes(1);

    first.settle();
    expect(await a).toBe("data:one");
    second.settle();
    expect(await b).toBe("data:two");
  });

  it("is null when the file cannot be read", async () => {
    invokeMock.mockRejectedValueOnce(new Error("gone"));
    expect(await imageThumbnail("/repo/.gello/assets/x/image.png")).toBeNull();
    expect(decodeMock).not.toHaveBeenCalled();
  });

  it("is null when the image cannot be decoded", async () => {
    invokeMock.mockResolvedValueOnce("bm90YW5pbWFnZQ==");
    decodeMock.mockRejectedValueOnce(new Error("decode failed"));
    expect(await imageThumbnail("/repo/.gello/assets/x/image.png")).toBeNull();
  });

  it("leaves a queued thumbnail unblocked after one fails", async () => {
    invokeMock.mockRejectedValueOnce(new Error("gone")).mockResolvedValueOnce("b2s=");
    decodeMock.mockResolvedValueOnce({
      width: 100,
      height: 50,
      encode: () => "data:ok",
      release: vi.fn(),
    });

    const bad = imageThumbnail("/repo/.gello/assets/bad/image.png");
    const good = imageThumbnail("/repo/.gello/assets/good/image.png");

    expect(await bad).toBeNull();
    expect(await good).toBe("data:ok");
  });
});
