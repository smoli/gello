// Recent-projects list (c016): pure list ops + (de)serialization. Persisted
// app-locally via the app-flag store, never in the repo.

const MAX_RECENT = 8;

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
