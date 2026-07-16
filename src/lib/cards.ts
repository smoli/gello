// The single frontmatter I/O module (see CLAUDE.md): no other module may
// parse or write card/milestone YAML.
//
// Design: YAML is only ever *parsed*. Writes are surgical line edits on the
// original raw text, so untouched lines — formatting, comments, unknown
// fields — survive byte-for-byte. Dumping via a YAML serializer would
// normalize all of that away and pollute git diffs.

import YAML from "yaml";

export type Priority = "low" | "normal" | "high";
const PRIORITIES: readonly Priority[] = ["low", "normal", "high"];

export interface BoardConfig {
  columns: string[];
  wipLimits: Record<string, number>;
  /** Card types (c024): open set, `task` is the implicit default type. */
  types: string[];
}

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  columns: ["backlog", "ready", "in-progress", "review", "done"],
  wipLimits: {},
  types: ["task", "bug"],
};

export interface Card {
  id: string;
  title: string;
  status: string;
  /** Card type (c024): "task" unless the frontmatter says otherwise. */
  type: string;
  /** Provenance (c024): id of the card this one was found in, or null. */
  ref: string | null;
  milestone: string | null;
  priority: Priority;
  depends: string[];
  tags: string[];
  created: string | null;
  updated: string | null;
  body: string;
  raw: string;
  path: string;
}

export interface Milestone {
  id: string;
  title: string;
  status: string;
  due: string | null;
  body: string;
  raw: string;
  path: string;
}

export interface InvalidFile {
  path: string;
  raw: string;
  reason: string;
}

export type CardParseResult =
  | { ok: true; card: Card }
  | { ok: false; invalid: InvalidFile };

export type MilestoneParseResult =
  | { ok: true; milestone: Milestone }
  | { ok: false; invalid: InvalidFile };

// --- frontmatter block handling ---------------------------------------------

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---(\n|$)/;

interface FrontmatterSplit {
  /** YAML text between the delimiters, without them. */
  block: string;
  /** Everything after the closing delimiter line. */
  body: string;
  /** Length of the full `---…---\n` prefix in the raw text. */
  prefixLength: number;
}

function splitFrontmatter(raw: string): FrontmatterSplit | null {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return null;
  return {
    block: match[1],
    body: raw.slice(match[0].length),
    prefixLength: match[0].length,
  };
}

type ParsedYaml = Record<string, unknown>;

function parseYamlBlock(
  block: string,
): { ok: true; data: ParsedYaml } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = YAML.parse(block);
  } catch (error) {
    return { ok: false, reason: `YAML error: ${(error as Error).message}` };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: "YAML frontmatter is not a mapping" };
  }
  return { ok: true, data: data as ParsedYaml };
}

// --- field coercion helpers --------------------------------------------------

function asRequiredString(data: ParsedYaml, field: string): string | null {
  const value = data[field];
  if (typeof value === "string" && value.trim() !== "") return value;
  return null;
}

function asOptionalString(data: ParsedYaml, field: string): string | null {
  const value = data[field];
  if (value === undefined || value === null) return null;
  return String(value);
}

function asStringArray(
  data: ParsedYaml,
  field: string,
): { ok: true; value: string[] } | { ok: false; reason: string } {
  const value = data[field];
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (typeof value === "string") return { ok: true, value: [value] };
  if (Array.isArray(value)) return { ok: true, value: value.map(String) };
  return { ok: false, reason: `field "${field}" must be a list` };
}

// --- parsing -----------------------------------------------------------------

export function parseCard(
  path: string,
  raw: string,
  config: BoardConfig = DEFAULT_BOARD_CONFIG,
): CardParseResult {
  const invalid = (reason: string): CardParseResult => ({
    ok: false,
    invalid: { path, raw, reason },
  });

  const split = splitFrontmatter(raw);
  if (!split) return invalid("no frontmatter block found");

  const parsed = parseYamlBlock(split.block);
  if (!parsed.ok) return invalid(parsed.reason);
  const data = parsed.data;

  const missing = ["id", "title", "status"].filter(
    (field) => asRequiredString(data, field) === null,
  );
  if (missing.length > 0) {
    return invalid(`missing required field(s): ${missing.join(", ")}`);
  }
  const id = asRequiredString(data, "id")!;
  const title = asRequiredString(data, "title")!;
  const status = asRequiredString(data, "status")!;

  if (!config.columns.includes(status)) {
    return invalid(
      `unknown status "${status}" (allowed: ${config.columns.join(", ")})`,
    );
  }

  const type = asOptionalString(data, "type") ?? "task";
  if (!config.types.includes(type)) {
    return invalid(
      `unknown type "${type}" (allowed: ${config.types.join(", ")})`,
    );
  }

  const priorityRaw = data["priority"];
  let priority: Priority = "normal";
  if (priorityRaw !== undefined && priorityRaw !== null) {
    if (!PRIORITIES.includes(priorityRaw as Priority)) {
      return invalid(
        `invalid priority "${String(priorityRaw)}" (allowed: ${PRIORITIES.join(", ")})`,
      );
    }
    priority = priorityRaw as Priority;
  }

  const depends = asStringArray(data, "depends");
  if (!depends.ok) return invalid(depends.reason);
  const tags = asStringArray(data, "tags");
  if (!tags.ok) return invalid(tags.reason);

  return {
    ok: true,
    card: {
      id,
      title,
      status,
      type,
      ref: asOptionalString(data, "ref"),
      milestone: asOptionalString(data, "milestone"),
      priority,
      depends: depends.value,
      tags: tags.value,
      created: asOptionalString(data, "created"),
      updated: asOptionalString(data, "updated"),
      body: split.body,
      raw,
      path,
    },
  };
}

export function parseMilestone(path: string, raw: string): MilestoneParseResult {
  const invalid = (reason: string): MilestoneParseResult => ({
    ok: false,
    invalid: { path, raw, reason },
  });

  const split = splitFrontmatter(raw);
  if (!split) return invalid("no frontmatter block found");

  const parsed = parseYamlBlock(split.block);
  if (!parsed.ok) return invalid(parsed.reason);
  const data = parsed.data;

  const missing = ["id", "title"].filter(
    (field) => asRequiredString(data, field) === null,
  );
  if (missing.length > 0) {
    return invalid(`missing required field(s): ${missing.join(", ")}`);
  }

  return {
    ok: true,
    milestone: {
      id: asRequiredString(data, "id")!,
      title: asRequiredString(data, "title")!,
      status: asOptionalString(data, "status") ?? "backlog",
      due: asOptionalString(data, "due"),
      body: split.body,
      raw,
      path,
    },
  };
}

export function parseBoardConfig(raw: string): {
  config: BoardConfig;
  error: string | null;
} {
  const defaults = (): BoardConfig => ({
    columns: [...DEFAULT_BOARD_CONFIG.columns],
    wipLimits: {},
    types: [...DEFAULT_BOARD_CONFIG.types],
  });

  let data: unknown;
  try {
    data = YAML.parse(raw);
  } catch (error) {
    return {
      config: defaults(),
      error: `YAML error: ${(error as Error).message}`,
    };
  }
  if (data === null || data === undefined) return { config: defaults(), error: null };
  if (typeof data !== "object" || Array.isArray(data)) {
    return { config: defaults(), error: "board.yaml is not a mapping" };
  }

  const config = defaults();
  const record = data as ParsedYaml;

  const columns = record["columns"];
  if (Array.isArray(columns) && columns.length > 0) {
    config.columns = columns.map(String);
  }

  const types = record["types"];
  if (Array.isArray(types) && types.length > 0) {
    config.types = types.map(String);
  }

  const wipLimits = record["wip_limits"];
  if (wipLimits !== null && typeof wipLimits === "object" && !Array.isArray(wipLimits)) {
    for (const [column, limit] of Object.entries(wipLimits)) {
      if (typeof limit === "number") config.wipLimits[column] = limit;
    }
  }

  return { config, error: null };
}

// --- creation -----------------------------------------------------------------

export interface NewCardOptions {
  /** Non-default card type, e.g. "bug". */
  type?: string;
  /** Provenance: card this one was found in. */
  ref?: string;
  /** Milestone id when the card is born inside a milestone folder. */
  milestone?: string;
}

/**
 * Raw content for a brand-new card (quick capture, report-bug): minimal
 * frontmatter with sensible defaults, optional body.
 */
export function newCardRaw(
  id: string,
  title: string,
  body: string,
  today: string,
  options: NewCardOptions = {},
): string {
  const lines = [
    `id: ${id}`,
    `title: ${formatScalar(title)}`,
    "status: backlog",
    "priority: normal",
  ];
  if (options.type) lines.push(`type: ${formatScalar(options.type)}`);
  if (options.ref) lines.push(`ref: ${formatScalar(options.ref)}`);
  if (options.milestone) lines.push(`milestone: ${formatScalar(options.milestone)}`);
  lines.push(`created: ${today}`, `updated: ${today}`);
  const trimmedBody = body.trim();
  return `---\n${lines.join("\n")}\n---\n${trimmedBody ? `\n${trimmedBody}\n` : ""}`;
}

// --- serialization (surgical edits) ------------------------------------------

/** Quote a scalar only when YAML would misread it plain. */
function formatScalar(value: string): string {
  return /[:#[\]{}"'\n&*|>%@`]|^[\s-]|\s$/.test(value) || value === ""
    ? JSON.stringify(value)
    : value;
}

/** Replace (or append) one `field: value` line inside the frontmatter block. */
function setFrontmatterField(raw: string, field: string, value: string): string {
  return setFrontmatterRawValue(raw, field, formatScalar(value));
}

/** Like setFrontmatterField, but takes an already-formatted YAML value. */
function setFrontmatterRawValue(
  raw: string,
  field: string,
  formattedValue: string,
): string {
  const split = splitFrontmatter(raw);
  if (!split) throw new Error("no frontmatter block found");

  const line = `${field}: ${formattedValue}`;
  const lineRe = new RegExp(`^${field}:.*$`, "m");
  const block = lineRe.test(split.block)
    ? split.block.replace(lineRe, line)
    : `${split.block}\n${line}`;

  return `${raw.slice(0, split.prefixLength).replace(split.block, block)}${split.body}`;
}

export type CardFieldChanges = Partial<
  Pick<Card, "status" | "priority" | "milestone" | "title" | "tags">
>;

/** Format a string[] as a flow-style YAML list: `[a, b]`. */
function formatFlowList(values: string[]): string {
  return `[${values.map(formatScalar).join(", ")}]`;
}

/**
 * Apply frontmatter field changes and bump `updated`. Untouched lines are
 * preserved byte-for-byte. Throws on changes that would produce an invalid
 * card (e.g. a status that is not a board column).
 */
export function updateCardFields(
  card: Card,
  changes: CardFieldChanges,
  today: string,
  config: BoardConfig = DEFAULT_BOARD_CONFIG,
): { card: Card; raw: string } {
  if (changes.status !== undefined && !config.columns.includes(changes.status)) {
    throw new Error(
      `unknown status "${changes.status}" (allowed: ${config.columns.join(", ")})`,
    );
  }

  let raw = card.raw;
  for (const [field, value] of Object.entries(changes)) {
    if (value === undefined || value === null) continue;
    raw = setFrontmatterRawValue(
      raw,
      field,
      Array.isArray(value) ? formatFlowList(value) : formatScalar(String(value)),
    );
  }
  raw = setFrontmatterField(raw, "updated", today);

  return { card: reparse(card.path, raw, config), raw };
}

/** Replace the card body, bump `updated`, keep the frontmatter block intact. */
export function replaceCardBody(
  card: Card,
  newBody: string,
  today: string,
  config: BoardConfig = DEFAULT_BOARD_CONFIG,
): { card: Card; raw: string } {
  const bumped = setFrontmatterField(card.raw, "updated", today);
  const split = splitFrontmatter(bumped);
  if (!split) throw new Error("no frontmatter block found");

  const raw = bumped.slice(0, split.prefixLength) + newBody;
  return { card: reparse(card.path, raw, config), raw };
}

function reparse(path: string, raw: string, config: BoardConfig): Card {
  const result = parseCard(path, raw, config);
  if (!result.ok) {
    // Internal invariant: our own edits must always yield a parseable card.
    throw new Error(`edit produced an invalid card: ${result.invalid.reason}`);
  }
  return result.card;
}
