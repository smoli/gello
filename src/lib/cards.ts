// The single frontmatter I/O module (see CLAUDE.md): no other module may
// parse or write card/milestone YAML.
//
// Design: YAML is only ever *parsed*. Writes are surgical line edits on the
// original raw text, so untouched lines — formatting, comments, unknown
// fields — survive byte-for-byte. Dumping via a YAML serializer would
// normalize all of that away and pollute git diffs.

import YAML from "yaml";

export interface BoardConfig {
  columns: string[];
  wipLimits: Record<string, number>;
  /** Card types (c024): open set, `task` is the implicit default type. */
  types: string[];
  /** Board background image (c047), path relative to the .gello root. */
  background: string | null;
}

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  // c0088: `inbox` is a normal status and the first column (was a folder).
  // i0033: `discuss` ships by default so the gello-discuss skill works out of
  // the box (a triage stage between inbox capture and backlog).
  columns: ["inbox", "discuss", "backlog", "ready", "in-progress", "review", "done"],
  wipLimits: {},
  types: ["task", "issue"],
  background: null,
};

export interface Card {
  id: string;
  title: string;
  status: string;
  /** Card type (c024): "task" unless the frontmatter says otherwise. */
  type: string;
  /** Provenance (c024): id of the card this one was found in, or null. */
  ref: string | null;
  /** c0076: epic membership (renamed from milestone); null = standalone. */
  epic: string | null;
  depends: string[];
  tags: string[];
  /** Manual position in backlog/ready columns (c056); null = unranked. */
  order: number | null;
  /** When the current status was assigned, ISO datetime (c056). */
  statusChanged: string | null;
  created: string | null;
  updated: string | null;
  body: string;
  raw: string;
  path: string;
}

/** c0076: an epic (renamed from milestone) — a single-container folder for a
 *  large effort broken into cards. `epic.md` carries id, title, status. */
export interface Epic {
  id: string;
  title: string;
  status: string;
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

export type EpicParseResult =
  | { ok: true; epic: Epic }
  | { ok: false; invalid: InvalidFile };

// --- frontmatter block handling ---------------------------------------------

// Line-ending agnostic: a card authored on macOS/Linux (LF) becomes CRLF under
// git's core.autocrlf on Windows, and some editors prepend a UTF-8 BOM. The
// bytes on disk are the source of truth, so we detect the block tolerantly and
// preserve whatever endings the file already uses rather than rewriting them.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;
const BOM = 0xfeff;

/** The dominant end-of-line sequence in `raw` (CRLF if any CRLF is present). */
function detectEol(raw: string): string {
  return raw.includes("\r\n") ? "\r\n" : "\n";
}

interface FrontmatterSplit {
  /** YAML text between the delimiters, without them. */
  block: string;
  /** Everything after the closing delimiter line. */
  body: string;
  /** Length of the full `---…---\n` prefix in the raw text. */
  prefixLength: number;
}

function splitFrontmatter(raw: string): FrontmatterSplit | null {
  // A leading UTF-8 BOM (some Windows editors add one) sits before `---`; skip
  // it for matching but keep it in the byte offsets so writes preserve it.
  const bomLen = raw.charCodeAt(0) === BOM ? 1 : 0;
  const match = FRONTMATTER_RE.exec(bomLen ? raw.slice(bomLen) : raw);
  if (!match) return null;
  return {
    block: match[1],
    body: raw.slice(bomLen + match[0].length),
    prefixLength: bomLen + match[0].length,
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

  // i0025: `priority` was removed — a leftover line is just an ignored field
  const depends = asStringArray(data, "depends");
  if (!depends.ok) return invalid(depends.reason);
  const tags = asStringArray(data, "tags");
  if (!tags.ok) return invalid(tags.reason);

  const orderRaw = data["order"];
  let order: number | null = null;
  if (orderRaw !== undefined && orderRaw !== null) {
    if (typeof orderRaw !== "number" || !Number.isFinite(orderRaw)) {
      return invalid(`field "order" must be a number`);
    }
    order = orderRaw;
  }

  return {
    ok: true,
    card: {
      id,
      title,
      status,
      type,
      ref: asOptionalString(data, "ref"),
      // c0076: canonical `epic:`, falling back to legacy `milestone:`
      epic: asOptionalString(data, "epic") ?? asOptionalString(data, "milestone"),
      depends: depends.value,
      tags: tags.value,
      order,
      statusChanged: asOptionalString(data, "status-changed"),
      created: asOptionalString(data, "created"),
      updated: asOptionalString(data, "updated"),
      body: split.body,
      raw,
      path,
    },
  };
}

/** c0076: parse an `epic.md` (or legacy `milestone.md`) container file. */
export function parseEpic(path: string, raw: string): EpicParseResult {
  const invalid = (reason: string): EpicParseResult => ({
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
    epic: {
      id: asRequiredString(data, "id")!,
      title: asRequiredString(data, "title")!,
      status: asOptionalString(data, "status") ?? "backlog",
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
    background: null,
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

  const background = record["background"];
  if (typeof background === "string" && background.trim() !== "") {
    config.background = background;
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
  /** Non-default card type, e.g. "issue". */
  type?: string;
  /** Provenance: card this one was found in. */
  ref?: string;
  /** c0076: epic id when the card is born inside an epic folder. */
  epic?: string;
  /** c0089: initial status (default "backlog"; capture uses "inbox"). */
  status?: string;
}

/**
 * Raw content for a brand-new card (quick capture, report-issue): minimal
 * frontmatter with sensible defaults, optional body.
 */
export function newCardRaw(
  id: string,
  title: string,
  body: string,
  now: string,
  options: NewCardOptions = {},
): string {
  const lines = [
    `id: ${id}`,
    `title: ${formatScalar(title)}`,
    `status: ${options.status ?? "backlog"}`,
  ];
  if (options.type) lines.push(`type: ${formatScalar(options.type)}`);
  if (options.ref) lines.push(`ref: ${formatScalar(options.ref)}`);
  if (options.epic) lines.push(`epic: ${formatScalar(options.epic)}`);
  // c056: created keeps the full capture time; updated stays a plain date
  lines.push(`created: ${now}`, `updated: ${now.slice(0, 10)}`);
  const trimmedBody = body.trim();
  return `---\n${lines.join("\n")}\n---\n${trimmedBody ? `\n${trimmedBody}\n` : ""}`;
}

/**
 * i0028: scaffold a new epic's `epic.md` — id, title, `status: backlog`, a
 * `## Goal` (from the captured goal) and an empty `## Definition of done` to
 * fill in later. Matches the epic format in concept.md §4 (id/title/status).
 */
export function newEpicRaw(id: string, title: string, goal: string): string {
  const frontmatter = [`id: ${id}`, `title: ${formatScalar(title)}`, "status: backlog"];
  const trimmedGoal = goal.trim();
  return (
    `---\n${frontmatter.join("\n")}\n---\n\n` +
    `## Goal\n\n${trimmedGoal ? `${trimmedGoal}\n` : ""}\n` +
    `## Definition of done\n\n`
  );
}

// --- serialization (surgical edits) ------------------------------------------

/** Quote a scalar only when YAML would misread it plain. A colon only
 *  needs quoting when followed by whitespace/end — `12:30` and ISO
 *  datetimes are valid plain scalars (c056). */
function formatScalar(value: string): string {
  return /:(\s|$)|[#[\]{}"'\n&*|>%@`]|^[\s-]|\s$/.test(value) || value === ""
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
    : `${split.block}${detectEol(raw)}${line}`;

  return `${raw.slice(0, split.prefixLength).replace(split.block, block)}${split.body}`;
}

/** Top-level `key:` at the start of a frontmatter line (not a list item or an
 *  indented/continuation line). */
const FRONTMATTER_KEY_RE = /^([^:\s][^:]*):/;

/**
 * i0034: collapse duplicate top-level frontmatter keys, keeping the last value
 * (YAML rejects duplicate keys, so such a card can't be loaded or edited in the
 * app — this is the one-click repair from the needs-attention lane). Returns the
 * fixed raw, or null when there is nothing to collapse.
 */
export function collapseDuplicateFrontmatterKeys(raw: string): string | null {
  const split = splitFrontmatter(raw);
  if (!split) return null;
  const eol = detectEol(raw);
  const lines = split.block.split(/\r?\n/);
  const keyOf = (line: string): string | null =>
    FRONTMATTER_KEY_RE.exec(line)?.[1] ?? null;

  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = keyOf(line);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set(
    [...counts].filter(([, n]) => n > 1).map(([key]) => key),
  );
  if (dupes.size === 0) return null;

  // keep only the last occurrence of each duplicated key
  const lastIndex = new Map<string, number>();
  lines.forEach((line, i) => {
    const key = keyOf(line);
    if (key && dupes.has(key)) lastIndex.set(key, i);
  });
  const kept = lines.filter((line, i) => {
    const key = keyOf(line);
    return !(key && dupes.has(key)) || lastIndex.get(key) === i;
  });

  const newBlock = kept.join(eol);
  return raw.slice(0, split.prefixLength).replace(split.block, newBlock) + split.body;
}

/** Remove one `field: …` line from the frontmatter block, if present. */
function removeFrontmatterField(raw: string, field: string): string {
  const split = splitFrontmatter(raw);
  if (!split) throw new Error("no frontmatter block found");

  // Consume the line's leading newline (LF or CRLF) too, so removing a middle
  // field leaves no blank line and no dangling CR.
  const lineRe = new RegExp(`(\\r?\\n)?^${field}:.*$`, "m");
  const block = split.block.replace(lineRe, "");
  return `${raw.slice(0, split.prefixLength).replace(split.block, block)}${split.body}`;
}

export type CardFieldChanges = Partial<
  Pick<
    Card,
    "status" | "epic" | "title" | "tags" | "order" | "statusChanged"
  >
>;

/** Card properties whose frontmatter key differs from the property name. */
const FRONTMATTER_KEYS: Record<string, string> = {
  statusChanged: "status-changed",
};

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
    if (value === undefined) continue;
    const key = FRONTMATTER_KEYS[field] ?? field;
    // null = remove the line (c056: e.g. clearing a stale manual order)
    if (value === null) {
      raw = removeFrontmatterField(raw, key);
      continue;
    }
    // numbers are written verbatim — formatScalar would quote a leading "-"
    // (negative order), which then re-parses as a string (i0007)
    const formatted = Array.isArray(value)
      ? formatFlowList(value)
      : typeof value === "number"
        ? String(value)
        : formatScalar(String(value));
    raw = setFrontmatterRawValue(raw, key, formatted);
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
