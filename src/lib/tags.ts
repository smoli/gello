// Tags as the cross-cutting label axis (c0058). Pure helpers over the board
// model: which tags are in use, their colours, and rename planning. Epics are
// the container axis; tags are orthogonal labels a card may carry several of.

import type { BoardModel } from "./board";
import type { Card } from "./cards";

/** Every card on the board — standalone and epic-grouped alike. */
function allCards(model: BoardModel): Card[] {
  return [...model.cards, ...model.epics.flatMap((g) => g.cards)];
}

/** A tag in use with how many cards carry it. */
export interface TagCount {
  tag: string;
  count: number;
}

/** All tags in use with a per-tag card count, sorted by tag name. */
export function collectTags(model: BoardModel): TagCount[] {
  const counts = new Map<string, number>();
  for (const card of allCards(model)) {
    for (const tag of card.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/** A fixed palette of chip colours. Auto colours are drawn from it by name. */
export const TAG_PALETTE: readonly string[] = [
  "#e11d48", // rose
  "#db2777", // pink
  "#9333ea", // purple
  "#4f46e5", // indigo
  "#2563eb", // blue
  "#0ea5e9", // sky
  "#0d9488", // teal
  "#059669", // emerald
  "#65a30d", // lime
  "#ca8a04", // amber
  "#ea580c", // orange
  "#78716c", // stone
];

/** Stable colour for a tag with no override: a palette slot from a name hash. */
export function autoTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

/** A tag's colour: the user override if set, else its auto colour. */
export function tagColor(tag: string, overrides: Record<string, string>): string {
  return overrides[tag] ?? autoTagColor(tag);
}

/** Parse a hex colour ("#rgb", "#rrggbb", or without the hash) to [r, g, b]. */
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
}

/** [r, g, b] back to a "#rrggbb" string. */
function toHex(r: number, g: number, b: number): string {
  const pair = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${pair(r)}${pair(g)}${pair(b)}`;
}

/** A legible text colour ("#111111" or "#ffffff") for a chip filled with the
 *  given hex background, chosen by perceived luminance. */
export function readableTextColor(hex: string): string {
  const [r, g, b] = parseHex(hex);
  // perceived luminance (0–255); above the threshold reads as a light fill
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 140 ? "#111111" : "#ffffff";
}

/** Mix a hex colour toward white by `amount` (0 = unchanged, 1 = white). The
 *  pale fill of an unselected tag filter chip: it keeps the tag's hue while
 *  giving the label a light, opaque backing that stays legible over any board
 *  background (i0110). */
export function tintColor(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const mix = (c: number) => c + (255 - c) * amount;
  return toHex(mix(r), mix(g), mix(b));
}

/** The dark base an in-dark-mode chip fill is mixed toward (i0114): a near-black
 *  slate, not pure black, so the tag hue still reads through the shaded fill. */
const CHIP_DARK_BASE = "#16181d";

/** Mix a hex colour toward the dark chip base by `amount` (0 = unchanged,
 *  1 = the base). The dark-mode counterpart of `tintColor`: a light tint reads
 *  as a glaring pale pill over a dark UI, so dark mode shades the same hue down
 *  to a muted fill that takes light text (i0114). */
export function shadeColor(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const [br, bg, bb] = parseHex(CHIP_DARK_BASE);
  const mix = (c: number, base: number) => c + (base - c) * amount;
  return toHex(mix(r, br), mix(g, bg), mix(b, bb));
}

/** How far an unselected/resting chip's fill is mixed toward white (i0110). */
const CHIP_TINT = 0.82;

/** How far a dark-mode chip's fill is mixed toward the dark base (i0114). */
const CHIP_SHADE = 0.55;

/** Inline style for a tag chip's resting look, shared by every tag surface
 *  (i0113): a tinted fill, the tag colour as the border for identity, and
 *  contrast-picked text. Light mode tints the hue up toward white; dark mode
 *  shades it down toward a dark base so the chip is not a glaring pale pill
 *  (i0114). The board toolbar reuses it for unselected filter chips; a selected
 *  filter chip overrides the fill with the full tag colour. */
export function tagChipStyle(
  colour: string,
  dark = false,
): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const fill = dark ? shadeColor(colour, CHIP_SHADE) : tintColor(colour, CHIP_TINT);
  return {
    backgroundColor: fill,
    borderColor: colour,
    color: readableTextColor(fill),
  };
}

/** Replace `from` with `to` in a tag list, preserving order and deduping. */
export function renameTagInList(tags: string[], from: string, to: string): string[] {
  if (!tags.includes(from)) return tags;
  const renamed = tags.map((tag) => (tag === from ? to : tag));
  return renamed.filter((tag, i) => renamed.indexOf(tag) === i);
}

/** One card whose `tags:` changes under a rename, with its new list. */
export interface TagRenamePlanEntry {
  card: Card;
  tags: string[];
}

/**
 * Cards carrying `from`, each with the tag list it should get after renaming
 * `from`→`to` (merge/dedup when `to` is already present). Cards without `from`
 * are omitted — a rename only touches files it changes.
 */
export function planTagRename(
  model: BoardModel,
  from: string,
  to: string,
): TagRenamePlanEntry[] {
  return allCards(model)
    .filter((card) => card.tags.includes(from))
    .map((card) => ({ card, tags: renameTagInList(card.tags, from, to) }));
}
