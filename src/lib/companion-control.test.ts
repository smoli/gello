import { describe, expect, it } from "vitest";
import { appendControlRequest, CONTROL_REQUEST_CAP } from "./companion-control";

// c0119/c0141: the app is the sole writer of `.companion/control.json`; the
// companion reads it and acts on each new request once. This builds the next
// file content from the current file plus a new command — the shape must match
// the companion's parseControlRequests (id + kind + cardId).

describe("appendControlRequest", () => {
  it("adds a request with its kind to an empty/absent file", () => {
    const next = JSON.parse(appendControlRequest("", "id1", "stop", "c001"));
    expect(next).toEqual({ requests: [{ id: "id1", kind: "stop", cardId: "c001" }] });
  });

  it("writes a restart request", () => {
    const next = JSON.parse(appendControlRequest("", "id1", "restart", "c001"));
    expect(next.requests).toEqual([{ id: "id1", kind: "restart", cardId: "c001" }]);
  });

  it("keeps existing requests and appends the new one", () => {
    const current = JSON.stringify({
      requests: [{ id: "id1", kind: "stop", cardId: "c001" }],
    });
    const next = JSON.parse(appendControlRequest(current, "id2", "restart", "c002"));
    expect(next.requests).toEqual([
      { id: "id1", kind: "stop", cardId: "c001" },
      { id: "id2", kind: "restart", cardId: "c002" },
    ]);
  });

  it("tolerates malformed current content by starting fresh", () => {
    const next = JSON.parse(appendControlRequest("not json", "id1", "stop", "c001"));
    expect(next).toEqual({ requests: [{ id: "id1", kind: "stop", cardId: "c001" }] });
  });

  it("caps the history so the file cannot grow without bound", () => {
    let raw = "";
    for (let i = 0; i < CONTROL_REQUEST_CAP + 10; i++) {
      raw = appendControlRequest(raw, `id${i}`, "stop", `c${i}`);
    }
    const parsed = JSON.parse(raw);
    expect(parsed.requests).toHaveLength(CONTROL_REQUEST_CAP);
    expect(parsed.requests.at(-1).id).toBe(`id${CONTROL_REQUEST_CAP + 9}`);
    expect(parsed.requests[0].id).toBe(`id10`);
  });
});
