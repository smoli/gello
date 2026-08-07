// Bridges the Rust FS commands to the pure board loader.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { loadBoard, type BoardFile, type BoardModel } from "./board";
import { isLegacyBoard, planMigration, type MigrationPlan } from "./migration";
import { writeFileAtomic } from "./fs";
import { appendControlRequest } from "./companion-control";

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

/**
 * c0151: open a board file (a card's reference document) with the OS default
 * application. `relative` is board-relative; the Rust side refuses anything
 * outside the board.
 */
export async function openExternal(root: string, relative: string): Promise<void> {
  await invoke("open_asset", { root, relative });
}

/** c0152: show a folder — the open project's — in the OS file manager. Rejects
 *  when the path is gone or the desktop has no handler for it. */
export async function openFolder(path: string): Promise<void> {
  await invoke("open_folder", { path });
}

/** Delete one file (absolute path) — used by triage after the rewrite. */
export async function removeFile(path: string): Promise<void> {
  await invoke("remove_file", { path });
}

/** c0062: recursively delete a directory (a deleted card's asset folder). */
export async function removeDir(path: string): Promise<void> {
  await invoke("remove_dir", { path });
}

/** c0110: open the OS terminal running `gello-companion <projectDir>`. The app
 *  does not manage the process — the terminal owns it (Ctrl-C stops it). Rejects
 *  when the terminal/command cannot be launched, so the caller can surface it. */
export async function startCompanion(projectDir: string): Promise<void> {
  await invoke("start_companion", { projectDir });
}

/** c0119/c0141: command the companion via `.companion/control.json` (it is the
 *  sole reader). Tolerant of the file being absent; a fresh id makes each
 *  request act exactly once. */
async function writeControlRequest(
  root: string,
  kind: "stop" | "restart",
  cardId: string,
): Promise<void> {
  const path = `${root}/.companion/control.json`;
  let current = "";
  try {
    current = await readFileRaw(path);
  } catch {
    current = ""; // absent → start fresh
  }
  await writeFileAtomic(path, appendControlRequest(current, crypto.randomUUID(), kind, cardId));
}

/** c0119: stop the in-flight run for `cardId`. */
export async function requestStopRun(root: string, cardId: string): Promise<void> {
  await writeControlRequest(root, "stop", cardId);
}

/** c0141: restart a stopped card — the companion resumes its session in place. */
export async function requestRestartCard(root: string, cardId: string): Promise<void> {
  await writeControlRequest(root, "restart", cardId);
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

/** c0083: outcome of a board auto-commit (mirrors the Rust CommitOutcome). */
export type CommitOutcome =
  | { kind: "committed" }
  | { kind: "nothing" }
  | { kind: "not_a_repo" }
  | { kind: "mid_operation" }
  | { kind: "failed"; message: string };

/** c0083: worktree dirtiness, split board-only (`.gello/`) vs code. */
export interface WorktreeStatus {
  board_dirty: boolean;
  code_dirty: boolean;
}

/**
 * i0131: what git can say about the project (mirrors the Rust `GitStatus`).
 * `not_a_repo` is the quiet, expected case; `unavailable` carries git's reason
 * so a switched-off integration is never mistaken for a clean worktree.
 */
export type GitStatus =
  | { kind: "not_a_repo" }
  | { kind: "unavailable"; message: string }
  | ({ kind: "status" } & WorktreeStatus);

/** c0083: a changed `.gello/` file with its HEAD and worktree content. */
export interface BoardChangeRaw {
  path: string;
  head: string | null;
  work: string | null;
}

/** i0131: the changed board files, or why git couldn't list them. */
export type BoardChanges =
  | { kind: "not_a_repo" }
  | { kind: "unavailable"; message: string }
  | { kind: "changes"; changes: BoardChangeRaw[] };

/** c0083: commit only `.gello/` changes with the given message. */
export async function gitCommitBoard(
  root: string,
  message: string,
): Promise<CommitOutcome> {
  try {
    return await invoke<CommitOutcome>("git_commit_board", { root, message });
  } catch (error) {
    return { kind: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * c0083/i0131: board-vs-code worktree dirtiness, or why git couldn't say.
 * A missing Tauri boundary (the browser dev build, tests) is not a git fault —
 * it reads as `not_a_repo`, the quiet case.
 */
export async function gitWorktreeStatus(root: string): Promise<GitStatus> {
  try {
    return (await invoke<GitStatus | null>("git_worktree_status", { root })) ?? { kind: "not_a_repo" };
  } catch {
    return { kind: "not_a_repo" };
  }
}

/** c0083/i0131: changed `.gello/` files with HEAD + worktree content, or the reason. */
export async function gitBoardChanges(root: string): Promise<BoardChanges> {
  try {
    return (await invoke<BoardChanges | null>("git_board_changes", { root })) ?? { kind: "not_a_repo" };
  } catch {
    return { kind: "not_a_repo" };
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
  /** c0079: board is still in the pre-epic milestone format → gate on open. */
  legacy: boolean;
}

/**
 * c0079/c0091: apply a migration plan on disk. Writes the whole new tree first
 * (via the mkdir-p writer), then removes the old `milestones/` and `inbox/`
 * folders wholesale — so a failure or interruption leaves the old board fully
 * intact, never half-deleted. remove_dir tolerates a missing folder, so it is
 * safe to remove both unconditionally. Re-running is safe.
 */
export async function migrateBoard(root: string, plan: MigrationPlan): Promise<void> {
  await writeNewFiles(
    plan.writes.map((file) => ({ path: `${root}/${file.path}`, content: file.content })),
  );
  await removeDir(`${root}/milestones`);
  await removeDir(`${root}/inbox`);
}

/**
 * c0079: read the board's current on-disk bytes, plan the milestone→epic
 * migration from them, and apply it. Operates on true disk content (not a
 * possibly-stale model) so the rewrite is exact.
 */
export async function migrateLegacyBoard(root: string): Promise<void> {
  const files = await invoke<BoardFile[]>("read_board_files", { root });
  await migrateBoard(root, planMigration(files));
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

/**
 * c011: write a base64 image payload into `<root>/assets/<cardId>/`, choosing a
 * collision-free filename from `filename`. Returns the board-relative path.
 */
export async function writeAsset(
  root: string,
  cardId: string,
  filename: string,
  dataBase64: string,
): Promise<string> {
  return invoke<string>("write_asset", { root, cardId, filename, dataBase64 });
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
  const { scaffoldFiles, claudeMdContent, agentsMdContent } = await import(
    "./scaffold"
  );
  const files = scaffoldFiles(projectRoot);

  // CLAUDE.md: create it if absent, else append the convention (idempotent)
  const claudePath = `${projectRoot}/CLAUDE.md`;
  const claudeExisting = await readFileRaw(claudePath).catch(() => null);
  const claude = claudeMdContent(claudeExisting);
  if (claude !== claudeExisting) files.push({ path: claudePath, content: claude });

  // AGENTS.md: only update it when it already exists (don't create one)
  const agentsPath = `${projectRoot}/AGENTS.md`;
  const agentsExisting = await readFileRaw(agentsPath).catch(() => null);
  if (agentsExisting !== null) {
    const agents = agentsMdContent(agentsExisting);
    if (agents !== agentsExisting) files.push({ path: agentsPath, content: agents });
  }

  await writeNewFiles(files);
  return `${projectRoot}/.gello`;
}

/** c016: load the board rooted at (or above) a chosen folder; null if none. */
export async function loadBoardAt(folder: string): Promise<LoadedBoard | null> {
  try {
    const root = await invoke<string | null>("find_board_root_at", { folder });
    if (!root) return null;
    const files = await invoke<BoardFile[]>("read_board_files", { root });
    return { root, model: loadBoard(files), legacy: isLegacyBoard(files) };
  } catch {
    return null;
  }
}

/**
 * c0146: does `folder` still hold a board? A cheap existence check (no file
 * read) used to grey recent entries whose repo has moved or been deleted in the
 * project switcher. False outside Tauri or on any error.
 */
export async function boardExistsAt(folder: string): Promise<boolean> {
  try {
    return (await invoke<string | null>("find_board_root_at", { folder })) !== null;
  } catch {
    return false;
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
    return { root, model: loadBoard(files), legacy: isLegacyBoard(files) };
  } catch {
    return null;
  }
}
