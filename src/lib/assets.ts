//! c011: pure helpers for pasting/dragging image assets into a card and for
//! resolving the relative Markdown links back to on-disk paths. All I/O lives
//! in board-io.ts / the Rust shell — this module is browser-clean and tested.

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** File extension for an image mime type; png when unknown. */
export function extensionForMime(mime: string): string {
  return MIME_EXT[mime] ?? "png";
}

/**
 * Relative prefix from a card file up to the board root, so an asset at
 * `assets/<id>/<file>` can be linked from the card. `milestones/m/x.md` →
 * `../../`; `inbox/x.md` → `../`.
 */
export function assetLinkPrefix(cardPath: string): string {
  const depth = cardPath.split("/").length - 1;
  return "../".repeat(depth);
}

/** A kebab-cased, extension-correct filename for a new asset. */
export function suggestedAssetName(
  originalName: string | null,
  mime: string,
  stamp: string,
): string {
  const ext = extensionForMime(mime);
  if (!originalName) return `pasted-${stamp}.${ext}`;
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image";
  return `${slug}.${ext}`;
}

/** Splice `snippet` into `text` over [start, end); returns the new caret. */
export function insertAt(
  text: string,
  start: number,
  end: number,
  snippet: string,
): { text: string; cursor: number } {
  return {
    text: text.slice(0, start) + snippet + text.slice(end),
    cursor: start + snippet.length,
  };
}

/**
 * Resolve a Markdown image `src` (relative to the card file) to a
 * board-root-relative path. Remote (http/https) and data URLs pass through
 * unchanged so they render as-is.
 */
export function resolveFromCard(cardPath: string, src: string): string {
  if (/^(https?:|data:)/i.test(src)) return src;
  const segments = cardPath.split("/").slice(0, -1); // card's directory
  for (const part of src.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

/**
 * c012: the src of the first Markdown image in a body, or null. Used for the
 * board-card thumbnail. Captures up to the first whitespace or `)` so an
 * optional title (`![a](src "t")`) is dropped.
 */
export function firstImageSrc(body: string): string | null {
  const match = /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(body);
  return match ? match[1] : null;
}

/** Base64-encode bytes in the browser (chunked to avoid arg-spread limits). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
