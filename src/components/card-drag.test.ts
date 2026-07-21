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

// comments stripped, so a rule's selector isn't glued to the prose above it
const css = readFileSync(join(process.cwd(), "src/components/Board.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

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

// i0120 (the actual cause): the insert zone grows to a 28px hit area at
// dragstart and cancels that with -14px margins, so the column's height is
// meant to be unchanged. But the zone is a flex item in `.column-cards`, and a
// flex item shrinks by default — so as soon as the column overflows (exactly
// when it has a scrollbar) the 28px is compressed while the margins stay put.
// Measured in a browser at scrollTop 200: the zone was used at 5.4px, each one
// netted -22.6px, the column collapsed 368px and scrollTop was clamped to 16.
// Every card jumped, +161px at the top to -178px at the bottom, and WebKit
// aborts a drag whose source moves under the pointer. With the shrink pinned,
// every card moves 0px.
describe("insert zone drag hit area (i0120)", () => {
  const drag = ruleBody(".board-dragging .insert-zone");

  const px = (prop: string): number => {
    const match = new RegExp(`(?:^|;)\\s*${prop}:\\s*(-?[\\d.]+)px`).exec(drag);
    if (!match) throw new Error(`no ${prop} in \`.board-dragging .insert-zone\``);
    return Number(match[1]);
  };

  it("cancels its drag-time height with its margins, so the column cannot grow", () => {
    const margin = /(?:^|;)\s*margin:\s*(-?[\d.]+)px\s+0/.exec(drag);
    if (!margin) throw new Error("no `margin: <n>px 0` in `.board-dragging .insert-zone`");
    expect(px("height") + 2 * Number(margin[1])).toBe(0);
  });

  it("pins the height against flex shrink, or the cancellation is a lie", () => {
    // Without this the declared height is negotiable but the margins are not,
    // so an overflowing column collapses the moment a drag starts.
    expect(drag).toMatch(/flex-shrink:\s*0/);
  });
});
