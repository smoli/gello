// Bridges the Rust FS commands to the pure board loader.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { loadBoard, type BoardFile, type BoardModel } from "./board";

/** Current content of one file (absolute path) — for conflict checks. */
export async function readFileRaw(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

/** Delete one file (absolute path) — used by triage after the rewrite. */
export async function removeFile(path: string): Promise<void> {
  await invoke("remove_file", { path });
}

/**
 * Watch the board directory. `onChange` receives root-relative paths of
 * changed board files. Subscribes to the event stream *before* starting the
 * Rust watcher so no early event is missed. Returns a stop function.
 */
export async function watchBoard(
  root: string,
  onChange: (paths: string[]) => void,
): Promise<() => void> {
  const unlisten = await listen<string[]>("board-files-changed", (event) =>
    onChange(event.payload),
  );
  await invoke("watch_board", { root });
  return unlisten;
}

export interface LoadedBoard {
  /** Absolute path of the .gello directory — needed for writes. */
  root: string;
  model: BoardModel;
}

/**
 * Locate and load the board of the current project. Returns null when there
 * is no `.gello/` directory — or when running outside Tauri (plain browser),
 * where the invoke bridge is unavailable.
 */
export async function loadBoardFromDisk(): Promise<LoadedBoard | null> {
  try {
    const root = await invoke<string | null>("find_board_root");
    if (!root) return null;
    const files = await invoke<BoardFile[]>("read_board_files", { root });
    return { root, model: loadBoard(files) };
  } catch {
    return null;
  }
}
