import { describe, expect, it } from "vitest";
import { appendStopRequest, STOP_REQUEST_CAP } from "./companion-control";

// c0119: the app is the sole writer of `.companion/control.json`; the companion
// reads it and stops each new request once. This builds the next file content
// from the current file plus a new stop — the shape must match the companion's
// parseStopRequests.

describe("appendStopRequest", () => {
  it("adds a request to an empty/absent file", () => {
    const next = JSON.parse(appendStopRequest("", "id1", "c001"));
    expect(next).toEqual({ requests: [{ id: "id1", cardId: "c001" }] });
  });

  it("keeps existing requests and appends the new one", () => {
    const current = JSON.stringify({ requests: [{ id: "id1", cardId: "c001" }] });
    const next = JSON.parse(appendStopRequest(current, "id2", "c002"));
    expect(next.requests).toEqual([
      { id: "id1", cardId: "c001" },
      { id: "id2", cardId: "c002" },
    ]);
  });

  it("tolerates malformed current content by starting fresh", () => {
    const next = JSON.parse(appendStopRequest("not json", "id1", "c001"));
    expect(next).toEqual({ requests: [{ id: "id1", cardId: "c001" }] });
  });

  it("caps the history so the file cannot grow without bound", () => {
    let raw = "";
    for (let i = 0; i < STOP_REQUEST_CAP + 10; i++) {
      raw = appendStopRequest(raw, `id${i}`, `c${i}`);
    }
    const parsed = JSON.parse(raw);
    expect(parsed.requests).toHaveLength(STOP_REQUEST_CAP);
    // the newest is kept, the oldest dropped
    expect(parsed.requests.at(-1)).toEqual({
      id: `id${STOP_REQUEST_CAP + 9}`,
      cardId: `c${STOP_REQUEST_CAP + 9}`,
    });
    expect(parsed.requests[0].id).toBe(`id10`);
  });
});
