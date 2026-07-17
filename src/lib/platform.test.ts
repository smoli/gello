import { afterEach, describe, expect, it } from "vitest";
import { isMacOS } from "./platform";

function setUserAgent(value: string) {
  Object.defineProperty(navigator, "userAgent", {
    value,
    configurable: true,
  });
}

const original = navigator.userAgent;
afterEach(() => setUserAgent(original));

describe("isMacOS (i0017)", () => {
  it("is true for a macOS WKWebView user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    );
    expect(isMacOS()).toBe(true);
  });

  it("is false on Windows", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120",
    );
    expect(isMacOS()).toBe(false);
  });

  it("is false on Linux", () => {
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36");
    expect(isMacOS()).toBe(false);
  });
});
