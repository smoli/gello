// c0146: the MRU project switcher's selection logic — the Alt+Tab model over
// the `recent` list. Pure and separate from the key handling: given the frozen
// MRU snapshot and the current highlight, it decides what to preselect and how
// cycling wraps. The App owns the keys, the overlay renders the state.

/** i0158: the cross-project activity view as a switcher entry — a sentinel in
 *  the path list. A NUL is not legal in a path, so it can never collide. */
export const OVERVIEW = "\0activity";

/** Whether the activity view can be switched to, and whether it is the view
 *  you are looking at. It needs an open project, so with no board it is
 *  `unavailable`. */
export type OverviewMode = "open" | "closed" | "unavailable";

/**
 * The switcher's entries: the place you are in first, the rest behind it in
 * MRU order. `recent` is already most-recent-first, so the open project heads
 * it. An open activity view takes the top — it is where you are, and the board
 * behind it becomes the previous place. A closed one sits at the end, so
 * Ctrl+Shift+Tab reaches it in one step.
 */
export function switcherItems(recent: string[], overview: OverviewMode): string[] {
  if (overview === "unavailable") return recent;
  return overview === "open" ? [OVERVIEW, ...recent] : [...recent, OVERVIEW];
}

export interface SwitcherState {
  /** Frozen MRU snapshot taken when the switcher opened — never reordered while
   *  it is open. Most-recent first: the current project on top. */
  items: string[];
  /** Index of the highlighted entry. */
  selected: number;
}

/**
 * Open the switcher over the MRU list, preselecting the *second* entry — the
 * previously-visited project — so a single Ctrl+Tab and release jumps straight
 * back to it. Null when there is nothing to switch to (0 or 1 recent projects).
 */
export function openSwitcher(items: string[]): SwitcherState | null {
  if (items.length < 2) return null;
  return { items, selected: 1 };
}

/**
 * Move the selection by `step` (+1 down, -1 up), wrapping at both ends. The
 * frozen `items` are untouched — cycling only moves the highlight.
 */
export function cycleSwitcher(state: SwitcherState, step: number): SwitcherState {
  const n = state.items.length;
  const selected = (((state.selected + step) % n) + n) % n;
  return { ...state, selected };
}
