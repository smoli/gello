// Architectural guardrails (see CLAUDE.md):
// - all file writes go through src/lib/fs.ts (atomic write layer)
// - all frontmatter/YAML I/O goes through src/lib/cards.ts
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "src-tauri/", "node_modules/"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tauri-apps/plugin-fs",
              message:
                "File writes must go through src/lib/fs.ts (atomic write layer).",
            },
            {
              name: "yaml",
              message:
                "Frontmatter/YAML I/O must go through src/lib/cards.ts.",
            },
          ],
          patterns: [
            {
              group: ["node:fs", "node:fs/*", "fs", "fs/*"],
              message:
                "No direct FS access in app code; use src/lib/fs.ts.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='invoke'][arguments.0.value='write_file_atomic']",
          message:
            "Call writeFileAtomic from src/lib/fs.ts instead of invoking the command directly.",
        },
      ],
    },
  },
  {
    // the two modules that implement the guarded layers
    files: ["src/lib/fs.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["src/lib/cards.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // tests may read the real tree (dogfood test) and mock freely
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: { "no-restricted-imports": "off" },
  },
);
