// gello-companion (c0093) — a standalone Node CLI that watches a gello board
// and, on a card entering `ready`, emits a dispatch intent. It reuses the
// board core in `src/lib` (no re-parsing) and publishes a state file the
// desktop app reads. Dispatch itself (running an agent) is c0097; this is the
// scaffold: locate → watch → detect → publish.
//
// Run with Node 24+ (native TypeScript): `node companion/main.ts [dir]`.

import { watch } from "node:fs";
import { resolve } from "node:path";
import {
  findBoardRoot,
  loadBoardFrom,
  cardsEnteringReady,
  initialState,
  writeStateFile,
  companionStatePath,
  type CompanionState,
} from "./core.ts";
import { cardsAnswered, cardsAwaitingInput } from "./qa.ts";
import type { BoardModel } from "../src/lib/board.ts";

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function log(message: string): void {
  console.log(`[gello-companion] ${message}`);
}

function main(): void {
  const start = resolve(process.argv[2] ?? process.cwd());
  const root = findBoardRoot(start);
  if (!root) {
    console.error(`no .gello board found from ${start}`);
    process.exit(1);
  }
  log(`watching board at ${root}`);

  let model: BoardModel = loadBoardFrom(root);
  publish(root, model);

  // A dispatch intent for every card already sitting in `ready` at startup.
  for (const card of cardsEnteringReady(null, model)) announce(card.id);

  // Debounce watcher bursts (an atomic write is a delete+create, and a triage
  // touches several files); reload once things settle, then diff for new
  // `ready` cards. Ignore our own `.companion/` writes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(root, { recursive: true }, (_event, filename) => {
    if (filename && filename.replace(/\\/g, "/").startsWith(".companion/")) return;
    clearTimeout(timer);
    timer = setTimeout(() => reconcile(root, () => model, (m) => (model = m)), 150);
  });
}

function reconcile(
  root: string,
  get: () => BoardModel,
  set: (m: BoardModel) => void,
): void {
  let next: BoardModel;
  try {
    next = loadBoardFrom(root);
  } catch (error) {
    log(`reload failed: ${(error as Error).message}`);
    return;
  }
  const prev = get();
  for (const card of cardsEnteringReady(prev, next)) announce(card.id);
  // A parked open turn that just became fully answered is the resume trigger
  // (c0096). The actual session resume is the dispatch flow (c0097); here we
  // only detect and log the intent.
  for (const card of cardsAnswered(prev, next)) resume(card.id);
  set(next);
  publish(root, next);
}

/** c0097 will turn this into an actual run; for now, record + log the intent. */
function announce(cardId: string): void {
  log(`${cardId} entered ready → dispatch (runner not wired yet, c0097)`);
}

/** A card's open turn was answered — resume its session (c0097 wires the run). */
function resume(cardId: string): void {
  log(`${cardId} open turn answered → resume (runner not wired yet, c0097)`);
}

function publish(root: string, model: BoardModel): void {
  const ready = cardsEnteringReady(null, model).map((c) => c.id);
  const waiting = cardsAwaitingInput(model).map((c) => c.id);
  const status: CompanionState["status"] = waiting.length ? "waiting" : "idle";
  const state: CompanionState = { ...initialState(nowIso()), ready, waiting, status };
  try {
    writeStateFile(root, state);
  } catch (error) {
    log(`could not write ${companionStatePath(root)}: ${(error as Error).message}`);
  }
}

main();
