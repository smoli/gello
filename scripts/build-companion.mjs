// i0118: bundle the companion into a single file the desktop app can ship.
//
// The companion is TypeScript and shares the board core with the app
// (`src/lib`), whose modules use extensionless imports — so bare `node` cannot
// run it even with type stripping, and `tsx` only exists in the dev checkout.
// Bundling resolves both: one `.mjs` with every dependency inlined, run as
// `node gello-companion.mjs <project-dir>`.
//
// The output lands under `src-tauri/` so `tauri.conf.json` can name it as a
// bundle resource with no `../` path (Tauri rewrites those to `_up_/`).

import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(repo, "src-tauri/companion-dist/gello-companion.mjs");

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(repo, "companion/main.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  // Node 22+ ships with the app's supported runtimes; nothing here needs down-levelling.
  target: "node22",
  // The agent CLIs are spawned as processes, never imported — nothing to mark
  // external. Everything else (yaml, the MCP SDK, src/lib) is inlined.
  //
  // Some inlined deps ship CommonJS that calls `require()` at runtime (yaml
  // reaches for `node:process`). ESM output has no `require`, so esbuild's shim
  // throws "Dynamic require of ... is not supported" — give it a real one.
  // ESM (not CJS) output is required regardless: the MCP launch resolves its own
  // entry through `import.meta.url`.
  banner: {
    js: [
      "import { createRequire as __gelloCreateRequire } from 'node:module';",
      "const require = __gelloCreateRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});

console.log(`companion bundled → ${outfile}`);
