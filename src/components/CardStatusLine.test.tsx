import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CardStatusLine } from "./CardStatusLine";
import type { CardStatusLine as StatusLine } from "../lib/card-status";

const blocked: StatusLine = {
  kind: "blocked",
  text: "waiting on c002, c003 (missing)",
  className: "card-activity card-activity-blocked",
  blockers: [
    { id: "c002", missing: false },
    { id: "c003", missing: true },
  ],
};
const stopped: StatusLine = {
  kind: "stopped",
  text: "run stopped",
  className: "card-activity card-activity-stopped",
};
const countdown: StatusLine = {
  kind: "countdown",
  text: "picking up in 5s",
  className: "card-activity card-activity-pending",
};

describe("CardStatusLine (c0148)", () => {
  it("renders nothing when there is no line", () => {
    const { container } = render(<CardStatusLine line={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a plain-text line with its treatment class", () => {
    render(<CardStatusLine line={countdown} />);
    const line = screen.getByText("picking up in 5s");
    expect(line).toHaveClass("card-activity", "card-activity-pending");
  });

  // read-only mode (the card detail): no handlers → no interactive controls

  it("shows a stopped line as read-only text when no onRestart is given", () => {
    render(<CardStatusLine line={stopped} />);
    expect(screen.getByText("run stopped")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restart" })).not.toBeInTheDocument();
  });

  it("shows a blocked line as read-only text when no onOpenBlocker is given", () => {
    render(<CardStatusLine line={blocked} />);
    expect(screen.getByText(/waiting on c002, c003 \(missing\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // interactive mode (the card front): handlers → Restart / dep links

  it("offers Restart when onRestart is given", () => {
    const onRestart = vi.fn();
    render(<CardStatusLine line={stopped} onRestart={onRestart} />);
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it("makes present blockers clickable when onOpenBlocker is given, missing ones not", () => {
    const onOpenBlocker = vi.fn();
    render(<CardStatusLine line={blocked} onOpenBlocker={onOpenBlocker} />);
    fireEvent.click(screen.getByRole("button", { name: "c002" }));
    expect(onOpenBlocker).toHaveBeenCalledExactlyOnceWith("c002");
    // the missing dependency is not a link
    expect(screen.queryByRole("button", { name: /c003/ })).not.toBeInTheDocument();
    expect(screen.getByText(/c003 \(missing\)/)).toBeInTheDocument();
  });
});
