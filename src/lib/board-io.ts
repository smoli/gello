// Bridges the Rust FS commands to the pure board loader.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { loadBoard, type BoardFile, type BoardModel } from "./board";

/** Current content of one file (absolute path) — for conflict checks. */
export async function readFileRaw(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Load a local image (absolute path) as a data URL — board backgrounds. */
export async function imageDataUrl(path: string): Promise<string> {
  const base64 = await invoke<string>("read_file_base64", { path });
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const mime = IMAGE_MIME[extension] ?? "image/png";
  return `data:${mime};base64,${base64}`;
}

/** Delete one file (absolute path) — used by triage after the rewrite. */
export async function removeFile(path: string): Promise<void> {
  await invoke("remove_file", { path });
}

/** c032: existing agent-skill directories under the project root. */
export async function detectSkillDirs(projectRoot: string): Promise<string[]> {
  try {
    return await invoke<string[]>("detect_skill_dirs", { projectRoot });
  } catch {
    return [];
  }
}

/** Read one app-local flag (null when unset or outside Tauri). */
export async function appFlagGet(key: string): Promise<string | null> {
  try {
    return (await invoke<string | null>("app_flag_get", { key })) ?? null;
  } catch {
    return null;
  }
}

/** Persist one app-local flag. */
export async function appFlagSet(key: string, value: string): Promise<void> {
  try {
    await invoke("app_flag_set", { key, value });
  } catch {
    // outside Tauri — no-op
  }
}

/** Current git branch of the project (null = not a git repo). */
export async function gitBranch(root: string): Promise<string | null> {
  try {
    return (await invoke<string | null>("git_branch", { root })) ?? null;
  } catch {
    return null;
  }
}

/**
 * Watch the repo's `.git/HEAD`; `onChange` fires on checkout. Subscribes to
 * the event before starting the Rust watcher. Returns a stop function.
 */
export async function watchGitHead(
  root: string,
  onChange: () => void,
): Promise<() => void> {
  const unlisten = await listen("git-head-changed", () => onChange());
  await invoke("watch_git_head", { root });
  return unlisten;
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

/** c016: native folder picker — the chosen directory, or null if cancelled. */
export async function pickFolder(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const chosen = await open({ directory: true, multiple: false });
    return typeof chosen === "string" ? chosen : null;
  } catch {
    return null;
  }
}

/** c0060: native image-file picker — the chosen file path, or null. */
export async function pickImageFile(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const chosen = await open({
      directory: false,
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    return typeof chosen === "string" ? chosen : null;
  } catch {
    return null;
  }
}

/** c0060: copy an image into the board's assets/board/; returns the rel path. */
export async function setBoardImage(root: string, source: string): Promise<string> {
  return invoke<string>("set_board_image", { root, source });
}

/** Write files atomically, creating parent dirs (c017 scaffold, c032 skills). */
export async function writeNewFiles(
  files: Array<{ path: string; content: string }>,
): Promise<void> {
  await invoke("write_new_files", { files });
}

/** c017: scaffold a fresh `.gello/` board (+ CLAUDE.md convention) under a
 *  folder that has none. Returns the new `.gello` root. */
export async function initBoard(projectRoot: string): Promise<string> {
  const { scaffoldFiles, claudeMdContent } = await import("./scaffold");
  const files = scaffoldFiles(projectRoot);
  const claudePath = `${projectRoot}/CLAUDE.md`;
  const existing = await readFileRaw(claudePath).catch(() => null);
  const claude = claudeMdContent(existing);
  if (claude !== existing) files.push({ path: claudePath, content: claude });
  await writeNewFiles(files);
  return `${projectRoot}/.gello`;
}

/** c016: load the board rooted at (or above) a chosen folder; null if none. */
export async function loadBoardAt(folder: string): Promise<LoadedBoard | null> {
  try {
    const root = await invoke<string | null>("find_board_root_at", { folder });
    if (!root) return null;
    const files = await invoke<BoardFile[]>("read_board_files", { root });
    return { root, model: loadBoard(files) };
  } catch {
    return null;
  }
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
