import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EpicDetail } from "./EpicDetail";
import { parseCard, parseEpic } from "../lib/cards";

function epic() {
  const parsed = parseEpic(
    "epics/e07-dark-mode/epic.md",
    "---\nid: e07\ntitle: Dark mode\nstatus: backlog\n---\n\n## Goal\n\nShip dark theme.\n\n## Definition of done\n\n",
  );
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.epic;
}

function childCard() {
  const parsed = parseCard(
    "epics/e07-dark-mode/c010-toggle.md",
    "---\nid: c010\ntitle: Theme toggle\nstatus: ready\nepic: e07\n---\nx\n",
  );
  if (!parsed.ok) throw new Error("fixture must parse");
  return parsed.card;
}

describe("EpicDetail (i0028)", () => {
  it("shows the epic goal and an empty child rollup", () => {
    render(<EpicDetail epic={epic()} cards={[]} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "e07" })).toBeInTheDocument();
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
    expect(screen.getByText(/Ship dark theme/)).toBeInTheDocument();
    expect(screen.getByText("No cards yet.")).toBeInTheDocument();
  });

  it("lists child cards and opens one on click", () => {
    const onSelectCard = vi.fn();
    const card = childCard();
    render(<EpicDetail epic={epic()} cards={[card]} onClose={vi.fn()} onSelectCard={onSelectCard} />);
    expect(screen.getByText("Theme toggle")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Theme toggle"));
    expect(onSelectCard).toHaveBeenCalledWith(card);
  });

  it("closes on Escape and on the Close button", () => {
    const onClose = vi.fn();
    render(<EpicDetail epic={epic()} cards={[]} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
