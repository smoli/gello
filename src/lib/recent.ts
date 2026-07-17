// Recent-projects list (c016): pure list ops + (de)serialization. Persisted
// app-locally via the app-flag store, never in the repo.

import { projectFolder } from "./status";

const MAX_RECENT = 8;

/**
 * i0020: normalize stored entries to the project-folder path — older builds
 * stored the raw `.gello` board dir, which the picker then renders as ".gello".
 * Strips a trailing `.gello` segment (separator-agnostic, via projectFolder)
 * and de-dups entries that collapse together, preserving order (first wins).
 */
export function normalizeRecent(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of list) {
    const project = projectFolder(path).path;
    if (!seen.has(project)) {
      seen.add(project);
      out.push(project);
    }
  }
  return out;
}

/** Add `path` as the most-recent project: front, de-duplicated, capped. */
export function addRecent(list: string[], path: string, max = MAX_RECENT): string[] {
  return [path, ...list.filter((p) => p !== path)].slice(0, max);
}

/** Parse the stored flag string into a list of project paths. */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Serialize the list for the app-flag store. */
export function serializeRecent(list: string[]): string {
  return JSON.stringify(list);
}
