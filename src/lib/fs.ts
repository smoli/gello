// The only file-write API in the frontend. Everything that persists a card,
// milestone, or config goes through writeFileAtomic → the Rust atomic-write
// command (temp file + rename; see src-tauri/src/fs_write.rs).
//
// Direct FS access elsewhere is banned by lint (no-restricted-imports /
// no-restricted-syntax in eslint.config.js).

import { invoke } from "@tauri-apps/api/core";

interface FsErrorShape {
  kind: string;
  path: string;
  message: string;
}

export class FsWriteError extends Error {
  readonly kind: string;
  readonly path: string;

  constructor(shape: FsErrorShape) {
    super(`atomic write failed for ${shape.path}: ${shape.message}`);
    this.name = "FsWriteError";
    this.kind = shape.kind;
    this.path = shape.path;
  }
}

function toErrorShape(error: unknown, requestedPath: string): FsErrorShape {
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    "message" in error
  ) {
    const shape = error as Partial<FsErrorShape>;
    return {
      kind: String(shape.kind),
      path: String(shape.path ?? requestedPath),
      message: String(shape.message),
    };
  }
  return { kind: "Unknown", path: requestedPath, message: String(error) };
}

export async function writeFileAtomic(
  path: string,
  contents: string,
): Promise<void> {
  try {
    await invoke("write_file_atomic", { path, contents });
  } catch (error) {
    throw new FsWriteError(toErrorShape(error, path));
  }
}
