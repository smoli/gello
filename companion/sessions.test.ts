import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  sessionKey,
  sessionsPath,
  loadSessions,
  saveSessions,
  resolveSession,
  recordSession,
  newSessionId,
  ownedPath,
  loadOwned,
  saveOwned,
  type SessionMap,
} from "./sessions.ts";

function tempGello(): string {
  const root = join(
    tmpdir(),
    `gello-sessions-${process.pid}-${Math.random().toString(36).slice(2)}`,
    ".gello",
  );
  mkdirSync(root, { recursive: true });
  return root;
}

const card = (id: string, epic: string | null = null) => ({ id, epic });

describe("sessionKey", () => {
  it("keys by card in card scope", () => {
    expect(sessionKey(card("c001", "e01"), "card")).toBe("card:c001");
  });
  it("keys by epic in epic scope when the card has an epic", () => {
    expect(sessionKey(card("c001", "e01"), "epic")).toBe("epic:e01");
  });
  it("falls back to the card key in epic scope when the card has no epic", () => {
    expect(sessionKey(card("c002", null), "epic")).toBe("card:c002");
  });
});

describe("sessions store", () => {
  it("round-trips the map atomically under .companion/", () => {
    const root = tempGello();
    expect(sessionsPath(root)).toBe(join(root, ".companion", "sessions.json"));
    expect(loadSessions(root)).toEqual({}); // missing → empty

    const map: SessionMap = { "card:c001": "uuid-1", "epic:e01": "uuid-2" };
    saveSessions(root, map);

    expect(existsSync(sessionsPath(root))).toBe(true);
    expect(existsSync(`${sessionsPath(root)}.tmp`)).toBe(false);
    expect(loadSessions(root)).toEqual(map);
    // valid JSON on disk
    expect(JSON.parse(readFileSync(sessionsPath(root), "utf8"))).toEqual(map);
  });

  it("corrupt file loads as empty rather than throwing", () => {
    const root = tempGello();
    saveSessions(root, { "card:c001": "u" });
    // clobber with junk
    writeFileSync(sessionsPath(root), "{not json");
    expect(loadSessions(root)).toEqual({});
  });
});

// i0135: the durable owned-card set, so a stopped card is restartable after the
// companion restarts (needed under epic scope, where the session names no card).
describe("owned store", () => {
  it("round-trips the owned ids atomically under .companion/", () => {
    const root = tempGello();
    expect(ownedPath(root)).toBe(join(root, ".companion", "owned.json"));
    expect(loadOwned(root)).toEqual([]); // missing → empty

    saveOwned(root, ["c001", "c002"]);
    expect(existsSync(ownedPath(root))).toBe(true);
    expect(loadOwned(root)).toEqual(["c001", "c002"]);
  });

  it("tolerates a corrupt or wrong-shaped file, dropping non-strings", () => {
    const root = tempGello();
    saveOwned(root, []); // creates .companion/
    writeFileSync(ownedPath(root), "{not json");
    expect(loadOwned(root)).toEqual([]);
    writeFileSync(ownedPath(root), JSON.stringify(["c001", 5, null, "c003"]));
    expect(loadOwned(root)).toEqual(["c001", "c003"]);
  });
});

describe("resolveSession / recordSession", () => {
  it("resolves an existing session for the scope key, else null", () => {
    const map: SessionMap = { "card:c001": "uuid-1" };
    expect(resolveSession(map, card("c001"), "card")).toEqual({
      key: "card:c001",
      sessionId: "uuid-1",
    });
    expect(resolveSession(map, card("c999"), "card")).toEqual({
      key: "card:c999",
      sessionId: null,
    });
  });

  it("epic scope shares one session across the epic's cards", () => {
    const map: SessionMap = { "epic:e01": "shared" };
    expect(resolveSession(map, card("c001", "e01"), "epic").sessionId).toBe("shared");
    expect(resolveSession(map, card("c002", "e01"), "epic").sessionId).toBe("shared");
  });

  it("recordSession stores a new id under the key immutably", () => {
    const map: SessionMap = { "card:c001": "old" };
    const next = recordSession(map, "card:c002", "new");
    expect(next).toEqual({ "card:c001": "old", "card:c002": "new" });
    expect(map).toEqual({ "card:c001": "old" }); // original untouched
  });

  it("newSessionId returns a fresh UUID each call", () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
});
