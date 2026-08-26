// i0179: board-card thumbnails used to be the card's image at full resolution —
// base64'd into a data URL and held in component state for every card that has
// one. A screenshot-heavy board therefore kept every screenshot decoded in the
// webview at once: on gello's own board that is ~110MB of bitmap for images
// drawn into a 260x112 box, and it grows with every screenshot pasted. On
// Windows that is enough to kill the WebView2 renderer with "Out of Memory".
//
// The fix is to keep only a small copy. The full-size image is decoded, drawn
// once at thumbnail size, and released; what stays in state is a few KB. The
// decoding is serialised so the peak is one full-size bitmap rather than all of
// them. This module is the pure part — the canvas/Image seam that implements
// `Decode` is in thumbnail-browser.ts.

/**
 * Longest edge, in device pixels, of a retained board thumbnail. A card front is
 * about 260 CSS px wide and the thumbnail box is 7rem tall, so this covers a 2x
 * display with room to spare.
 */
export const THUMB_MAX_PX = 512;

export interface Size {
  width: number;
  height: number;
}

/**
 * Fit `source` into a box whose longest edge is `max`, preserving the aspect
 * ratio. A source that already fits is returned unchanged — a thumbnail is never
 * upscaled. The short edge is rounded but never to zero, since no canvas accepts
 * a zero dimension.
 */
export function fitBox(source: Size, max: number): Size {
  const { width, height } = source;
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** A decoded source image: its natural size, a re-encode at a smaller size, and
 *  the release that frees the full-size bitmap. */
export interface Decoded {
  width: number;
  height: number;
  /** Draw a copy scaled to `size` and encode it; null when it can't be encoded. */
  encode(size: Size): string | null;
  /** Drop the full-size bitmap. Called exactly once, however encoding went. */
  release(): void;
}

/** Decode the image at a URL into something that can be drawn small. */
export type Decode = (url: string) => Promise<Decoded>;

/**
 * Decode `url`, draw it at thumbnail size, release the full-size bitmap and
 * return the small data URL. Null when the image can't be decoded, has no
 * pixels, or can't be re-encoded — the caller renders no thumbnail, which is
 * what a broken image link already does (c012).
 */
export async function shrinkToThumbnail(
  url: string,
  max: number,
  decode: Decode,
): Promise<string | null> {
  let decoded: Decoded;
  try {
    decoded = await decode(url);
  } catch {
    return null;
  }
  try {
    const box = fitBox(decoded, max);
    if (box.width <= 0 || box.height <= 0) return null;
    return decoded.encode(box);
  } catch {
    return null;
  } finally {
    // the whole point of the exercise: the big bitmap must not outlive the draw
    decoded.release();
  }
}

/**
 * A gate that runs one job at a time, in the order they arrived. Thumbnails go
 * through it so a board with many card images decodes them one after another —
 * concurrent decodes would put every full-size bitmap in memory at once, which
 * is the situation being fixed. A failing job passes its rejection to its own
 * caller and does not block the rest.
 */
export function createSerialQueue(): <T>(job: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    // `then` rather than await so a synchronously-throwing job rejects rather
    // than escaping, and so the tail never inherits a rejection
    const result = tail.then(() => job());
    tail = result.catch(() => {});
    return result;
  };
}
