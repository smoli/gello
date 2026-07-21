import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// i0120: in the app, dragging a card selected its title text instead of moving
// the card. Card fronts never declared `user-select`, so the only thing making
// them unselectable was the UA stylesheet rule Blink ships for `[draggable]`:
//
//   [draggable=true] { -webkit-user-drag: element; -webkit-user-select: none; }
//
// Chromium has it, WebKit does not — and the app runs in WKWebView on macOS.
// So the drag worked in the browser and in tests, and only broke where it
// shipped. These assert the app declares the behaviour itself rather than
// inheriting it from whichever engine happens to be underneath.
//
// jsdom applies no UA drag rules and does no layout, so a rendered assertion
// would pass either way. Reading the stylesheet is what actually catches this.

const css = readFileSync(join(process.cwd(), "src/components/Board.css"), "utf8");

/** The declaration block of the rule whose selector is exactly `selector`. */
function ruleBody(selector: string): string {
  for (const [, head, body] of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    if (head.trim() === selector) return body;
  }
  throw new Error(`no \`${selector}\` rule in Board.css`);
}

describe("card front drag (i0120)", () => {
  it("makes the card front unselectable itself, not via a UA default", () => {
    const body = ruleBody(".card-front");
    expect(body).toMatch(/(^|[^-])user-select:\s*none/);
  });

  it("declares the WebKit-prefixed form, which is what macOS needs", () => {
    const body = ruleBody(".card-front");
    expect(body).toMatch(/-webkit-user-select:\s*none/);
  });

  it("marks the whole card front as the drag element", () => {
    const body = ruleBody(".card-front");
    expect(body).toMatch(/-webkit-user-drag:\s*element/);
  });
});
