import { describe, expect, it } from "vitest";
import { cardStatusLine, type CardStatusFacts } from "./card-status";
import type { CompanionState } from "./companion";
import { parseCard, type Card } from "./cards";

const NOW = Date.parse("2026-08-07T10:00:05");
const STAMP = "2026-08-07T10:00:00"; // 5s before NOW

function state(over: Partial<CompanionState> = {}): CompanionState {
  return {
    status: "idle",
    ready: [],
    waiting: [],
    runs: [],
    updated: "2026-08-07T10:00:05", // fresh → live
    pickupDelay: 10,
    owned: [],
    ...over,
  };
}

function card(over: { status?: string; statusChanged?: string } = {}): Card {
  const result = parseCard(
    "cards/c001-x.md",
    `---\nid: c001\ntitle: Card\nstatus: ${over.status ?? "ready"}\n${
      over.statusChanged ? `status-changed: ${over.statusChanged}\n` : ""
    }---\nbody\n`,
  );
  if (!result.ok) throw new Error("fixture must parse");
  return result.card;
}

const NO_FACTS: CardStatusFacts = {
  blocked: false,
  slotFree: true,
  slotWaiterTopId: null,
  blockers: [],
  startable: false,
};

describe("cardStatusLine (c0148)", () => {
  it("is null when nothing applies", () => {
    expect(cardStatusLine(null, card(), NO_FACTS, NOW)).toBeNull();
  });

  it("shows the running activity line, phrased by activity.ts", () => {
    const runner = state({
      status: "running",
      runs: [{ cardId: "c001", phase: "running", activity: { name: "Edit", arg: "runner.ts" } }],
    });
    const line = cardStatusLine(runner, card({ status: "in-progress" }), NO_FACTS, NOW);
    expect(line).toMatchObject({ kind: "activity", text: "Editing runner.ts" });
    expect(line?.className).toContain("card-activity");
  });

  it("shows the pickup countdown when a queued card waits out its grace period", () => {
    const runner = state({ ready: ["c001"], pickupDelay: 10 });
    const line = cardStatusLine(runner, card({ statusChanged: STAMP }), NO_FACTS, NOW);
    expect(line).toMatchObject({ kind: "countdown", text: "picking up in 5s" });
  });

  it("shows 'waiting on a slot' for the next-in-line card when WIP is full", () => {
    const runner = state({ ready: ["c001"], pickupDelay: 10 });
    const facts = { ...NO_FACTS, slotFree: false, slotWaiterTopId: "c001" };
    expect(cardStatusLine(runner, card(), facts, NOW)).toMatchObject({
      kind: "waiting-slot",
      text: "waiting on a slot",
    });
  });

  it("shows a funny queue line for a slot-waiter that is not next", () => {
    const runner = state({ ready: ["c001"], pickupDelay: 10 });
    const facts = { ...NO_FACTS, slotFree: false, slotWaiterTopId: "c999" };
    const line = cardStatusLine(runner, card(), facts, NOW);
    expect(line?.kind).toBe("waiting-slot");
    expect(line?.text).not.toBe("waiting on a slot"); // a queue line instead
  });

  it("shows 'run stopped' for a stopped, companion-owned card", () => {
    const runner = state({ owned: ["c001"], runs: [] });
    expect(
      cardStatusLine(runner, card({ status: "in-progress" }), NO_FACTS, NOW),
    ).toMatchObject({ kind: "stopped", text: "run stopped" });
  });

  it("names the unfinished dependencies when blocked, missing ones marked", () => {
    const facts = {
      ...NO_FACTS,
      blocked: true,
      blockers: [
        { id: "c002", missing: false },
        { id: "c003", missing: true },
      ],
    };
    const line = cardStatusLine(null, card(), facts, NOW);
    expect(line).toMatchObject({ kind: "blocked", text: "waiting on c002, c003 (missing)" });
    expect(line?.blockers).toHaveLength(2);
  });

  it("shows 'startable' for a backlog card whose dependencies cleared", () => {
    const facts = { ...NO_FACTS, startable: true };
    expect(cardStatusLine(null, card({ status: "backlog" }), facts, NOW)).toMatchObject({
      kind: "startable",
      text: "startable",
    });
  });

  it("prioritises a live activity line over a blocked one", () => {
    const runner = state({
      status: "running",
      runs: [{ cardId: "c001", phase: "running", activity: { name: "Edit", arg: "x.ts" } }],
    });
    const facts = { ...NO_FACTS, blocked: true, blockers: [{ id: "c002", missing: false }] };
    expect(cardStatusLine(runner, card({ status: "in-progress" }), facts, NOW)?.kind).toBe(
      "activity",
    );
  });
});
