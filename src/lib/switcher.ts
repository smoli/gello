// c0146: the MRU project switcher's selection logic — the Alt+Tab model over
// the `recent` list. Pure and separate from the key handling: given the frozen
// MRU snapshot and the current highlight, it decides what to preselect and how
// cycling wraps. The App owns the keys, the overlay renders the state.

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
