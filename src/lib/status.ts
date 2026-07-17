// Pure derivations for the status bar (c0057): project folder and per-column
// card tallies from the loaded board model.

import type { BoardModel } from "./board";

/** The folder that contains `.gello` — its basename and full path. */
export function projectFolder(root: string): { name: string; path: string } {
  const trimmed = root.replace(/\/+$/, ""); // drop trailing slash
  const path = trimmed.replace(/\/\.gello$/, "");
  const name = path.slice(path.lastIndexOf("/") + 1);
  return { name, path };
}

export interface ColumnCount {
  column: string;
  count: number;
}

/** Card tally per configured column, over inbox + milestone cards. */
export function cardCounts(model: BoardModel): ColumnCount[] {
  const all = [...model.inbox, ...model.milestones.flatMap((g) => g.cards)];
  return model.config.columns.map((column) => ({
    column,
    count: all.filter((c) => c.status === column).length,
  }));
}
