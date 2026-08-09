// The app side of the c0162 AFK flag: `.companion/afk.json`.
//
// The app is the sole writer of this file, the companion the sole reader (see
// companion/afk.ts, which this mirrors — the app does not import from
// companion/). Unlike control.json it carries level state, not a request log:
// the companion reads the current value.
//
//     .gello/.companion/afk.json     {"afk": true}
//
// Off unless the content says `{"afk": true}` — the same tolerance as the
// reader, so the control can never show AFK on for a file the companion reads
// as off.

/** Absolute path of the AFK flag file for a `.gello` root. */
export function afkFilePath(root: string): string {
  return `${root}/.companion/afk.json`;
}

/** The file content for a state. Off is written out, not left as an absent
 *  file: turning AFK off is a state the companion reads, not a deletion. */
export function afkFileContent(afk: boolean): string {
  return `${JSON.stringify({ afk }, null, 2)}\n`;
}

/** The state in the file's raw text; anything unrecognised is off. */
export function parseAfk(raw: string): boolean {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (typeof data !== "object" || data === null) return false;
  return (data as Record<string, unknown>).afk === true;
}
