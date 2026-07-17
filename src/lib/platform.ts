// i0017: coarse OS-family detection for platform-gated window chrome. macOS
// keeps its native traffic lights + overlay title bar (c0059); Windows/Linux
// run fully frameless with our own controls, so we only need "is this macOS?".

/** True when running on macOS (WKWebView), false on Windows/Linux (and in
 *  jsdom tests, whose user agent is neither). */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } })
    .userAgentData;
  if (uaData?.platform) return /mac/i.test(uaData.platform);
  return /mac os x|macintosh/i.test(navigator.userAgent);
}
