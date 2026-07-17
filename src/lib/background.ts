// Board background value handling (c0060). The `background:` config is one CSS
// string, classified by shape: an image asset path, a CSS color, or a
// two-colour linear-gradient. Only image mode involves a file.

export type BackgroundKind = "image" | "color" | "gradient";

export function classifyBackground(value: string): BackgroundKind {
  const v = value.trim();
  if (v.startsWith("linear-gradient(")) return "gradient";
  if (v.startsWith("#") || /^(rgb|hsl)a?\(/i.test(v)) return "color";
  return "image";
}

export interface Gradient {
  angle: number;
  from: string;
  to: string;
}

const GRADIENT_RE = /^linear-gradient\(\s*(-?\d+)deg\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/i;

export function parseGradient(value: string): Gradient | null {
  const m = GRADIENT_RE.exec(value.trim());
  if (!m) return null;
  return { angle: Number(m[1]), from: m[2].trim(), to: m[3].trim() };
}

export function formatGradient({ angle, from, to }: Gradient): string {
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

/**
 * The CSS `background-image`/`background` value to apply for a config value.
 * Images need a resolved data URL (from the Rust base64 bridge); colors and
 * gradients apply directly. Returns null when there is nothing to show yet.
 */
export function backgroundCss(
  value: string | null,
  imageDataUrl: string | undefined,
): string | null {
  if (!value) return null;
  switch (classifyBackground(value)) {
    case "image":
      return imageDataUrl ? `url(${imageDataUrl})` : null;
    case "color":
    case "gradient":
      return value;
  }
}
