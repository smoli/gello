// i0179: the webview half of thumbnail generation — an <img> decode plus a
// canvas draw. Platform-only, like notify.ts and window.ts: there is nothing
// here to test that isn't the browser's own behaviour. The logic that decides
// the size, releases the bitmap and orders the work is in thumbnail.ts.

import type { Decoded } from "./thumbnail";

/** Encoding for the retained copy. WebP is what keeps a screenshot thumbnail in
 *  the low tens of KB; a webview without WebP encoding hands back a PNG data
 *  URL instead, which still renders. */
const THUMB_MIME = "image/webp";
const THUMB_QUALITY = 0.8;

/**
 * Decode the image at `url` (a data URL from `imageDataUrl`) so it can be drawn
 * small. `release` drops the element's request, which is what frees the
 * full-size bitmap; the canvas backing store is freed the same way as soon as
 * the small copy has been encoded.
 */
export function decodeImage(url: string): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        encode: (size) => {
          const canvas = document.createElement("canvas");
          canvas.width = size.width;
          canvas.height = size.height;
          const context = canvas.getContext("2d");
          if (!context) return null;
          context.drawImage(image, 0, 0, size.width, size.height);
          const encoded = canvas.toDataURL(THUMB_MIME, THUMB_QUALITY);
          canvas.width = 0;
          canvas.height = 0;
          return encoded;
        },
        // dropping the src attribute unsets the element's current request, so
        // the decoded full-size bitmap goes at once rather than at the next GC
        release: () => image.removeAttribute("src"),
      });
    image.onerror = () => reject(new Error("could not decode image"));
    image.src = url;
  });
}
