import { describe, expect, it } from "vitest";
import {
  addReference,
  parseReferences,
  referenceKind,
  removeReference,
  stripReferences,
} from "./references";

const BODY = `## What

Something to build.

## Acceptance criteria

- [ ] works

## Log

- 2026-08-07 status → in-progress (agent)
`;

const WITH_REFS = `## What

Something to build.

## References

- [spec.pdf](../../assets/c0151/spec.pdf)
- [design notes.md](../../assets/c0151/design-notes.md)

## Log

- 2026-08-07 status → in-progress (agent)
`;

describe("references", () => {
  describe("parseReferences", () => {
    it("reads the entries of the References section in order", () => {
      expect(parseReferences(WITH_REFS)).toEqual([
        { label: "spec.pdf", target: "../../assets/c0151/spec.pdf" },
        { label: "design notes.md", target: "../../assets/c0151/design-notes.md" },
      ]);
    });

    it("is empty when the card has no References section", () => {
      expect(parseReferences(BODY)).toEqual([]);
    });

    it("ignores links outside the References section", () => {
      const body = `## What\n\nSee [elsewhere](../x.md).\n`;
      expect(parseReferences(body)).toEqual([]);
    });

    it("ignores prose lines inside the section", () => {
      const body = `## References\n\nSome note.\n\n- [a.pdf](../assets/c1/a.pdf)\n`;
      expect(parseReferences(body)).toEqual([
        { label: "a.pdf", target: "../assets/c1/a.pdf" },
      ]);
    });
  });

  describe("addReference", () => {
    it("creates the section above the machine-managed Log", () => {
      const next = addReference(BODY, {
        label: "spec.pdf",
        target: "../../assets/c0151/spec.pdf",
      });
      expect(next).toContain("## References\n\n- [spec.pdf](../../assets/c0151/spec.pdf)");
      expect(next.indexOf("## References")).toBeLessThan(next.indexOf("## Log"));
      // the Log section survives untouched, and stays last
      expect(next).toContain("- 2026-08-07 status → in-progress (agent)");
      expect(parseReferences(next)).toEqual([
        { label: "spec.pdf", target: "../../assets/c0151/spec.pdf" },
      ]);
    });

    it("appends to an existing section, keeping the earlier entries", () => {
      const next = addReference(WITH_REFS, {
        label: "third.txt",
        target: "../../assets/c0151/third.txt",
      });
      expect(parseReferences(next)).toEqual([
        { label: "spec.pdf", target: "../../assets/c0151/spec.pdf" },
        { label: "design notes.md", target: "../../assets/c0151/design-notes.md" },
        { label: "third.txt", target: "../../assets/c0151/third.txt" },
      ]);
    });

    it("keeps two same-named files apart — the store deduped the path", () => {
      const once = addReference(BODY, {
        label: "spec.pdf",
        target: "../../assets/c0151/spec.pdf",
      });
      const twice = addReference(once, {
        label: "spec.pdf",
        target: "../../assets/c0151/spec-2.pdf",
      });
      expect(parseReferences(twice)).toEqual([
        { label: "spec.pdf", target: "../../assets/c0151/spec.pdf" },
        { label: "spec.pdf", target: "../../assets/c0151/spec-2.pdf" },
      ]);
    });

    it("creates the section on an empty body", () => {
      const next = addReference("", { label: "a.pdf", target: "../assets/c1/a.pdf" });
      expect(parseReferences(next)).toEqual([
        { label: "a.pdf", target: "../assets/c1/a.pdf" },
      ]);
    });
  });

  describe("removeReference", () => {
    it("drops only the entry with that target", () => {
      const next = removeReference(WITH_REFS, "../../assets/c0151/spec.pdf");
      expect(parseReferences(next)).toEqual([
        { label: "design notes.md", target: "../../assets/c0151/design-notes.md" },
      ]);
      expect(next).toContain("## References");
    });

    it("removes the whole section once the last entry is gone", () => {
      let next = removeReference(WITH_REFS, "../../assets/c0151/spec.pdf");
      next = removeReference(next, "../../assets/c0151/design-notes.md");
      expect(next).not.toContain("## References");
      expect(next).toContain("## What");
      expect(next).toContain("## Log");
    });

    it("leaves the body alone when the target isn't there", () => {
      expect(removeReference(WITH_REFS, "../../assets/c0151/nope.pdf")).toBe(WITH_REFS);
    });
  });

  describe("stripReferences", () => {
    it("cuts the section for rendering, leaving the rest", () => {
      const stripped = stripReferences(WITH_REFS);
      expect(stripped).not.toContain("## References");
      expect(stripped).not.toContain("spec.pdf");
      expect(stripped).toContain("Something to build.");
      expect(stripped).toContain("## Log");
    });

    it("is a no-op without the section", () => {
      expect(stripReferences(BODY)).toBe(BODY);
    });
  });

  describe("referenceKind", () => {
    it("renders markdown inline", () => {
      expect(referenceKind("../assets/c1/notes.md")).toBe("markdown");
      expect(referenceKind("../assets/c1/NOTES.MARKDOWN")).toBe("markdown");
    });

    it("renders plain text inline", () => {
      expect(referenceKind("../assets/c1/notes.txt")).toBe("text");
      expect(referenceKind("../assets/c1/data.csv")).toBe("text");
      expect(referenceKind("../assets/c1/config.yaml")).toBe("text");
    });

    it("opens anything else externally", () => {
      expect(referenceKind("../assets/c1/spec.pdf")).toBe("external");
      expect(referenceKind("../assets/c1/mock.png")).toBe("external");
      expect(referenceKind("../assets/c1/README")).toBe("external");
    });
  });
});
