import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// i0156: the cross-project view (c0138) drew its bar under the frameless title
// bar. The bar overlays the top 34px with z-index 8 and a Tauri drag region, so
// "← Back to board", the project chips and their × sat behind it: a click
// dragged the window instead of hitting the control.
//
// Every view that fills the frameless shell has to pad its content below the
// bar. jsdom does no layout, so a rendered assertion can't see the overlap —
// reading the stylesheet is what catches this (as in i0136).

const css = readFileSync(join(process.cwd(), "src/App.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The declarations of every rule whose selector is exactly `selector`. */
function ruleBody(selector: string): string {
  const found: string[] = [];
  for (const [, head, body] of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    for (const one of head.split(",")) if (one.trim() === selector) found.push(body);
  }
  if (found.length === 0) throw new Error(`no \`${selector}\` rule in App.css`);
  return found.join(";");
}

// The roots of the views App renders as the shell's content: the board, and the
// c0138 activity view that replaces it.
const SHELL_VIEWS = [".board", ".multi"];

describe("frameless shell clearance (i0156)", () => {
  it.each(SHELL_VIEWS)("pads `%s` below the title bar", (view) => {
    const body = ruleBody(`.app-shell-frameless ${view}`);
    const padding = /(?:^|;)\s*padding-top:\s*([^;]+)/.exec(body);
    if (!padding) throw new Error(`no \`padding-top\` for \`${view}\``);
    expect(padding[1]).toContain("var(--titlebar-height)");
  });
});
