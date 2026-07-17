import { describe, expect, it } from "vitest";
import {
  classifyBackground,
  formatGradient,
  parseGradient,
  backgroundCss,
} from "./background";

describe("classifyBackground", () => {
  it("classifies gradients, colors, and image paths by shape", () => {
    expect(classifyBackground("linear-gradient(45deg, #aabbcc, #112233)")).toBe("gradient");
    expect(classifyBackground("#1a2b3c")).toBe("color");
    expect(classifyBackground("rgb(10, 20, 30)")).toBe("color");
    expect(classifyBackground("assets/board/bg.jpg")).toBe("image");
    expect(classifyBackground("background.png")).toBe("image");
  });
});

describe("parseGradient / formatGradient", () => {
  it("round-trips angle + two colors", () => {
    const g = "linear-gradient(120deg, #ff0000, #0000ff)";
    expect(parseGradient(g)).toEqual({ angle: 120, from: "#ff0000", to: "#0000ff" });
    expect(formatGradient({ angle: 120, from: "#ff0000", to: "#0000ff" })).toBe(g);
  });

  it("tolerates whitespace and returns null for non-gradients", () => {
    expect(parseGradient("linear-gradient( 45deg ,#a1a1a1 , #b2b2b2 )")).toEqual({
      angle: 45,
      from: "#a1a1a1",
      to: "#b2b2b2",
    });
    expect(parseGradient("#123456")).toBeNull();
  });
});

describe("backgroundCss", () => {
  it("uses the resolved data URL for image backgrounds", () => {
    expect(backgroundCss("assets/board/bg.jpg", "data:image/jpeg;base64,QQ==")).toBe(
      "url(data:image/jpeg;base64,QQ==)",
    );
  });

  it("returns null for an image without a resolved data URL yet", () => {
    expect(backgroundCss("assets/board/bg.jpg", undefined)).toBeNull();
  });

  it("applies colors and gradients directly as CSS (no file)", () => {
    expect(backgroundCss("#1a2b3c", undefined)).toBe("#1a2b3c");
    expect(backgroundCss("linear-gradient(90deg, #a, #b)", undefined)).toBe(
      "linear-gradient(90deg, #a, #b)",
    );
  });

  it("returns null for an empty background", () => {
    expect(backgroundCss(null, undefined)).toBeNull();
  });
});
