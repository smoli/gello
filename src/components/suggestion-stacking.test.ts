import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// i0136: the c0145 tag suggestions rendered *behind* the card detail — the
// "Add dependency" input below drew over the list, and the body text showed
// through it. The list declares `z-index: 5`, so it should have won.
//
// The cause is `opacity: 0.9` on the field label that wraps it. An opacity
// below 1 makes the element a stacking context, which traps every z-index
// inside it: the list could no longer be compared against the positioned
// elements further down the dialog, only against its own siblings. The label
// itself has no z-index, so DOM order decided, and everything after it won.
// The same 0.9 also painted the list at 90% opacity, which is the body text
// bleeding through.
//
// jsdom does no layout or painting and applies no stacking rules, so a
// rendered assertion passes either way (i0120). Reading the stylesheet is what
// catches this.

// comments stripped, so a rule's selector isn't glued to the prose above it
const css = readFileSync(join(process.cwd(), "src/components/CardDetail.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Every rule in the sheet, as [selector, declarations] with the selector
 *  lists split so a shared rule is checked once per selector. */
function rules(): [string, string][] {
  const out: [string, string][] = [];
  for (const [, head, body] of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    for (const selector of head.split(",")) out.push([selector.trim(), body]);
  }
  return out;
}

/** The declarations of the rule whose selector is exactly `selector`. */
function ruleBody(selector: string): string {
  const found = rules().filter(([head]) => head === selector);
  if (found.length === 0) throw new Error(`no \`${selector}\` rule in CardDetail.css`);
  return found.map(([, body]) => body).join(";");
}

// The properties that make an element a stacking context and so cut a
// descendant's z-index off from the rest of the dialog.
const STACKING = [
  /(^|[^-])opacity:\s*(?!1\b)/,
  /(^|[^-])transform:\s*(?!none)/,
  /(^|[^-])filter:\s*(?!none)/,
  /backdrop-filter:/,
  /mix-blend-mode:\s*(?!normal)/,
  /isolation:\s*isolate/,
  /will-change:/,
  /(^|[^-])perspective:\s*(?!none)/,
  /contain:\s*(?:layout|paint|strict|content)/,
];

// Everything between the tag suggestion list and `.card-detail-backdrop`, the
// stacking context the whole dialog is meant to share.
const ANCESTORS = [
  ".card-detail",
  ".card-detail-fields",
  ".card-detail-fields label",
  ".card-detail-tags",
];

describe("suggestion dropdown stacking (i0136)", () => {
  it("keeps the suggestion list above the dialog UI below it", () => {
    const body = ruleBody(".tag-suggestions");
    const zIndex = /(?:^|;)\s*z-index:\s*(\d+)/.exec(body);
    if (!zIndex) throw new Error("no `z-index` in `.tag-suggestions`");
    // the controls it overlaps are positioned with z-index auto, so anything
    // above 0 wins — as long as no ancestor traps it
    expect(Number(zIndex[1])).toBeGreaterThan(0);
    expect(body).toMatch(/position:\s*absolute/);
  });

  it.each(ANCESTORS)("does not let `%s` become a stacking context", (selector) => {
    const body = ruleBody(selector);
    for (const property of STACKING) expect(body).not.toMatch(property);
  });

  it("dims the field label without an opacity, so nothing is trapped", () => {
    // the label text is still shown at reduced strength — via `color`, which
    // affects the text alone and starts no stacking context
    expect(ruleBody(".card-detail-fields label")).toMatch(/(^|;)\s*color:/);
  });
});
