import { describe, expect, it } from "vitest";
import {
  assetLinkPrefix,
  bytesToBase64,
  extensionForMime,
  firstImageSrc,
  insertAt,
  resolveFromCard,
  suggestedAssetName,
  suggestedFileAssetName,
} from "./assets";

describe("assetLinkPrefix", () => {
  it("goes up two levels for a milestone card", () => {
    expect(assetLinkPrefix("milestones/m03-card-detail/c011-x.md")).toBe("../../");
  });

  it("goes up one level for an inbox card", () => {
    expect(assetLinkPrefix("inbox/c001-idea.md")).toBe("../");
  });
});

describe("extensionForMime", () => {
  it("maps common image mimes", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("image/gif")).toBe("gif");
  });

  it("falls back to png for an unknown mime", () => {
    expect(extensionForMime("image/tiff")).toBe("png");
    expect(extensionForMime("")).toBe("png");
  });
});

describe("suggestedAssetName", () => {
  it("uses a readable timestamped name for a clipboard paste (no original name)", () => {
    expect(suggestedAssetName(null, "image/png", "20260717-120301")).toBe(
      "pasted-20260717-120301.png",
    );
  });

  it("keeps a dragged file's own (sanitized) name", () => {
    expect(suggestedAssetName("Screen Shot.png", "image/png", "x")).toBe(
      "screen-shot.png",
    );
  });

  it("gives a named file the right extension even if it lacks one", () => {
    expect(suggestedAssetName("diagram", "image/webp", "x")).toBe("diagram.webp");
  });
});

describe("suggestedFileAssetName (c0151)", () => {
  it("keeps the original extension, whatever the type", () => {
    expect(suggestedFileAssetName("Design Spec.PDF", "x")).toBe("design-spec.pdf");
    expect(suggestedFileAssetName("notes.md", "x")).toBe("notes.md");
    expect(suggestedFileAssetName("archive.tar.gz", "x")).toBe("archive-tar.gz");
  });

  it("keeps a name that has no extension", () => {
    expect(suggestedFileAssetName("README", "x")).toBe("readme");
  });

  it("falls back to a timestamped name when there is none", () => {
    expect(suggestedFileAssetName(null, "20260807-120301")).toBe(
      "reference-20260807-120301",
    );
    expect(suggestedFileAssetName("...", "20260807-120301")).toBe(
      "reference-20260807-120301",
    );
  });
});

describe("insertAt", () => {
  it("splices a snippet at a collapsed cursor and returns the new caret", () => {
    const { text, cursor } = insertAt("ab", 1, 1, "X");
    expect(text).toBe("aXb");
    expect(cursor).toBe(2);
  });

  it("replaces a selection", () => {
    const { text, cursor } = insertAt("abcd", 1, 3, "X");
    expect(text).toBe("aXd");
    expect(cursor).toBe(2);
  });
});

describe("resolveFromCard", () => {
  it("resolves a milestone card's relative link back to a board-relative path", () => {
    expect(
      resolveFromCard("milestones/m03-x/c011-x.md", "../../assets/c011/shot.png"),
    ).toBe("assets/c011/shot.png");
  });

  it("resolves an inbox card's relative link", () => {
    expect(resolveFromCard("inbox/c001-x.md", "../assets/c001/shot.png")).toBe(
      "assets/c001/shot.png",
    );
  });

  it("returns remote and data URLs unchanged", () => {
    expect(resolveFromCard("inbox/c1.md", "https://x/y.png")).toBe("https://x/y.png");
    expect(resolveFromCard("inbox/c1.md", "data:image/png;base64,AA")).toBe(
      "data:image/png;base64,AA",
    );
  });

  // c0151: a reference link is card-relative, and an agent resolves it against
  // the card's own directory — the same walk this function does. Whatever
  // folder the card sits in, the link points back at the asset under the board
  // root, so the app and the agent reach the same file.
  it("round-trips a card-relative asset link from any card folder", () => {
    for (const cardPath of [
      "cards/c0151-x.md",
      "cards/archive/c0151-x.md",
      "epics/e03-card-detail/c0151-x.md",
      "epics/e03-card-detail/archive/c0151-x.md",
    ]) {
      const link = `${assetLinkPrefix(cardPath)}assets/c0151/spec.pdf`;
      expect(resolveFromCard(cardPath, link)).toBe("assets/c0151/spec.pdf");
    }
  });
});

describe("firstImageSrc", () => {
  it("returns the src of the first image", () => {
    const body = "intro\n\n![shot](../../assets/c012/a.png)\n\n![two](b.png)";
    expect(firstImageSrc(body)).toBe("../../assets/c012/a.png");
  });

  it("drops an optional title", () => {
    expect(firstImageSrc('![a](x.png "a title")')).toBe("x.png");
  });

  it("returns null when there is no image", () => {
    expect(firstImageSrc("just **text** and a [link](page.md)")).toBeNull();
  });
});

describe("bytesToBase64", () => {
  it("round-trips through atob", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const b64 = bytesToBase64(bytes);
    const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});
