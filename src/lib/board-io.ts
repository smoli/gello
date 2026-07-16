// Bridges the Rust FS commands to the pure board loader.

import { invoke } from "@tauri-apps/api/core";
import { loadBoard, type BoardFile, type BoardModel } from "./board";

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
