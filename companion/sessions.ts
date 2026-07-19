// gello-companion session store (c0095): persist the mapping from a card (or
// its epic) to its agent session UUID, so a run resumes prior context instead
// of starting cold. Lives under `.gello/.companion/` (gitignored runtime
// state, like the state file).

import { join } from "node:path";
import { companionDir, writeJsonAtomic, readJson } from "./core.ts";

/** Whether sessions are kept per card (default) or shared per epic. */
export type SessionScope = "card" | "epic";

/** A minimal card shape — id plus its epic membership (null = standalone). */
interface CardRef {
  id: string;
  epic: string | null;
}

/** The key a session is stored under. Per-epic scope shares one session across
 *  the epic's cards; a card with no epic falls back to its own key. */
export function sessionKey(card: CardRef, scope: SessionScope): string {
  if (scope === "epic" && card.epic) return `epic:${card.epic}`;
  return `card:${card.id}`;
}

/** key → agent session UUID. */
export type SessionMap = Record<string, string>;

export function sessionsPath(root: string): string {
  return join(companionDir(root), "sessions.json");
}

export function loadSessions(root: string): SessionMap {
  return readJson<SessionMap>(sessionsPath(root), {});
}

export function saveSessions(root: string, map: SessionMap): void {
  writeJsonAtomic(sessionsPath(root), map);
}

/** The session id to resume for this card under the scope, or null to start
 *  fresh — along with the key it would be recorded under. */
export function resolveSession(
  map: SessionMap,
  card: CardRef,
  scope: SessionScope,
): { key: string; sessionId: string | null } {
  const key = sessionKey(card, scope);
  return { key, sessionId: map[key] ?? null };
}

/** Return a new map with `key` set to `sessionId` (original untouched). */
export function recordSession(
  map: SessionMap,
  key: string,
  sessionId: string,
): SessionMap {
  return { ...map, [key]: sessionId };
}
