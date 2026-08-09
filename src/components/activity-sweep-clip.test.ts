import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// i0178: the c0113 sweep band on a live activity line escaped the card detail —
// it drew over the backdrop to the left of the dialog. The band is a
// pseudo-element that starts at `translateX(-100%)`, i.e. one full line width
// outside the line, and relies on being clipped until it sweeps in. On a card
// front `.card-activity` clips it with `overflow: hidden`, but the detail
// relaxes that to `visible` so a long blocked list can wrap — and with nothing
// clipping, the off-box band became visible.
//
// The clip belongs on the rule that owns the band, so no context can relax it:
// `clip-path` clips a pseudo-element to the border box whatever `overflow` says.
//
// jsdom does no layout or painting (i0120), so a rendered assertion passes
// either way. Reading the stylesheet is what catches this.

/** comments stripped, so a rule's selector isn't glued to the prose above it */
function sheet(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The declarations of every rule whose selector is exactly `selector`. */
function ruleBody(file: string, selector: string): string {
  const found: string[] = [];
  for (const [, head, body] of sheet(file).matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    for (const one of head.split(",")) if (one.trim() === selector) found.push(body);
  }
  if (found.length === 0) throw new Error(`no \`${selector}\` rule in ${file}`);
  return found.join(";");
}

const BOARD = "src/components/Board.css";
const DETAIL = "src/components/CardDetail.css";

describe("activity sweep clipping (i0178)", () => {
  it("clips the band on the line itself, not on an overridable `overflow`", () => {
    expect(ruleBody(BOARD, ".card-activity-live")).toMatch(/clip-path:\s*inset\(/);
  });

  it("still starts the band outside the line, so the clip is what hides it", () => {
    const band = ruleBody(BOARD, ".card-activity-live::after");
    expect(band).toMatch(/transform:\s*translateX\(-100%\)/);
    expect(band).toMatch(/animation:\s*card-activity-sweep/);
  });

  it("wraps a long token in the detail line instead of letting it out of the dialog", () => {
    // the detail relaxes the front's one-line truncation; an unbreakable token
    // needs a break opportunity, or it overflows the dialog like the band did
    expect(ruleBody(DETAIL, ".card-detail-status .card-activity")).toMatch(
      /overflow-wrap:\s*anywhere/,
    );
  });
});
