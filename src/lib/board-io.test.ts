import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { loadBoardFromDisk } from "./board-io";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);

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
