// Timestamp formatting for card frontmatter (c056), pure so both hosts share
// it: the app imports it through board-actions, the Node companion directly
// (board-actions pulls in Tauri and cannot be imported there).

/** Now as a local-time ISO datetime (c056) — lexicographically sortable,
 *  human-readable in the file, no timezone juggling for a local-first tool. */
export function nowIsoDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Today as a local ISO date (YYYY-MM-DD) for `updated` bumps. */
export function todayIsoDate(): string {
  return nowIsoDateTime().slice(0, 10);
}
