// i0123: edge auto-scroll while dragging a card. HTML5 drag-and-drop does not
// scroll an inner overflow container when the pointer reaches its top/bottom
// edge (WKWebView, the app's runtime, has no native inner-container autoscroll
// at all), so dragging a card from the bottom of a long column to the top meant
// drop, scroll, drag again. This computes how fast the container under the
// pointer should scroll; the Board runs it in a rAF loop during a drag.

/** How far from an edge the auto-scroll zone reaches, and the top speed. */
export interface EdgeScrollConfig {
  /** Edge band thickness in px — inside it, scrolling ramps up toward the edge. */
  zone: number;
  /** Scroll step in px per frame at the very edge (ramps to 0 at the band). */
  maxSpeed: number;
}

/**
 * Pixels to add to a scroll container's `scrollTop` for this frame, given the
 * container's viewport rect and the pointer's `clientY`. Negative scrolls up,
 * positive down, `0` when the pointer is outside the container or in its calm
 * middle. Speed ramps linearly from 0 at the band boundary to `maxSpeed` at the
 * edge; the nearer edge wins when a short container's bands overlap.
 */
export function edgeScrollDelta(
  rect: { top: number; bottom: number },
  pointerY: number,
  { zone, maxSpeed }: EdgeScrollConfig,
): number {
  if (zone <= 0 || maxSpeed <= 0) return 0;
  // outside the container — a drag that has left it should not scroll it
  if (pointerY < rect.top || pointerY > rect.bottom) return 0;

  const fromTop = pointerY - rect.top;
  const fromBottom = rect.bottom - pointerY;

  // the nearer edge takes it when both bands overlap (container < 2*zone tall)
  if (fromTop <= fromBottom) {
    if (fromTop < zone) return -maxSpeed * (1 - fromTop / zone);
  } else {
    if (fromBottom < zone) return maxSpeed * (1 - fromBottom / zone);
  }
  return 0;
}
