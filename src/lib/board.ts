// Board loader: turns the files under .gello/ into one typed BoardModel.
// Pure — no filesystem access; callers (Tauri layer, tests) supply the files.

import {
  parseBoardConfig,
  parseCard,
  parseMilestone,
  type BoardConfig,
  type Card,
  type InvalidFile,
  type Milestone,
  type Priority,
} from "./cards";

export interface BoardFile {
  /** Path relative to the .gello/ root, forward slashes. */
  path: string;
  content: string;
}

export interface MilestoneGroup {
  /** Folder name under milestones/, e.g. "m01-foundation". */
  folder: string;
  /** Parsed milestone.md, or null if the folder has none. */
  milestone: Milestone | null;
  cards: Card[];
}

export interface BoardModel {
  config: BoardConfig;
  configError: string | null;
  milestones: MilestoneGroup[];
  inbox: Card[];
  invalid: InvalidFile[];
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

function byPriorityThenId(a: Card, b: Card): number {
  const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priority !== 0) return priority;
  return a.id.localeCompare(b.id);
}

export function loadBoard(files: BoardFile[]): BoardModel {
  const configFile = files.find((f) => f.path === "board.yaml");
  const { config, error: configError } = parseBoardConfig(
    configFile?.content ?? "",
  );

  const inbox: Card[] = [];
  const invalid: InvalidFile[] = [];
  const groups = new Map<string, MilestoneGroup>();

  const groupFor = (folder: string): MilestoneGroup => {
    let group = groups.get(folder);
    if (!group) {
      group = { folder, milestone: null, cards: [] };
      groups.set(folder, group);
    }
    return group;
  };

  for (const { path, content } of files) {
    if (!path.endsWith(".md")) continue;
    const segments = path.split("/");

    if (segments.length === 2 && segments[0] === "inbox") {
      const result = parseCard(path, content, config);
      if (result.ok) inbox.push(result.card);
      else invalid.push(result.invalid);
    } else if (segments.length === 3 && segments[0] === "milestones") {
      const folder = segments[1];
      if (segments[2] === "milestone.md") {
        const result = parseMilestone(path, content);
        if (result.ok) groupFor(folder).milestone = result.milestone;
        else invalid.push(result.invalid);
      } else {
        const result = parseCard(path, content, config);
        if (result.ok) groupFor(folder).cards.push(result.card);
        else invalid.push(result.invalid);
      }
    }
    // everything else (concept.md, assets, deeper nesting) is not board data
  }

  inbox.sort(byPriorityThenId);
  const milestones = [...groups.values()].sort((a, b) =>
    a.folder.localeCompare(b.folder),
  );
  for (const group of milestones) group.cards.sort(byPriorityThenId);
  invalid.sort((a, b) => a.path.localeCompare(b.path));

  return { config, configError, milestones, inbox, invalid };
}

/** Immutably add a freshly captured card to the inbox, keeping sort order. */
export function withNewInboxCard(model: BoardModel, card: Card): BoardModel {
  return { ...model, inbox: [...model.inbox, card].sort(byPriorityThenId) };
}

/**
 * Immutably move a triaged card out of the inbox (matched by its old path)
 * into a milestone group, keeping sort order.
 */
export function withCardTriaged(
  model: BoardModel,
  oldPath: string,
  moved: Card,
  targetFolder: string,
): BoardModel {
  return {
    ...model,
    inbox: model.inbox.filter((c) => c.path !== oldPath),
    milestones: model.milestones.map((group) =>
      group.folder === targetFolder
        ? { ...group, cards: [...group.cards, moved].sort(byPriorityThenId) }
        : group,
    ),
  };
}

/**
 * Immutably replace one card (matched by path) with an updated version —
 * used for optimistic UI updates after a status change.
 */
export function withUpdatedCard(model: BoardModel, updated: Card): BoardModel {
  const replace = (card: Card): Card =>
    card.path === updated.path ? updated : card;
  return {
    ...model,
    inbox: model.inbox.map(replace),
    milestones: model.milestones.map((group) => ({
      ...group,
      cards: group.cards.map(replace),
    })),
  };
}

// --- ID derivation -------------------------------------------------------------

function maxIdNumber(candidates: string[], prefix: string): number {
  const re = new RegExp(`^${prefix}(\\d+)`);
  let max = 0;
  for (const candidate of candidates) {
    const match = re.exec(candidate);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Next free card ID. Invalid files reserve their filename-derived ID too, so
 * a broken card never gets its ID handed out twice.
 */
export function nextCardId(model: BoardModel): string {
  const candidates = [
    ...model.inbox.map((c) => c.id),
    ...model.milestones.flatMap((g) => g.cards.map((c) => c.id)),
    ...model.invalid.map((entry) => basename(entry.path)),
  ];
  const next = maxIdNumber(candidates, "c") + 1;
  return `c${String(next).padStart(3, "0")}`;
}

export function nextMilestoneId(model: BoardModel): string {
  const candidates = model.milestones.flatMap((g) => [
    g.folder,
    ...(g.milestone ? [g.milestone.id] : []),
  ]);
  const next = maxIdNumber(candidates, "m") + 1;
  return `m${String(next).padStart(2, "0")}`;
}
