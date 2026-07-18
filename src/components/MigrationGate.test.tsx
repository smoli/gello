import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MigrationGate } from "./MigrationGate";

describe("MigrationGate (c0079)", () => {
  it("explains the migration and triggers it on click", () => {
    const onMigrate = vi.fn();
    render(<MigrationGate onMigrate={onMigrate} busy={false} error={null} />);

    expect(screen.getByRole("dialog", { name: "board needs migration" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Migrate board" }));
    expect(onMigrate).toHaveBeenCalledOnce();
  });

  it("disables the button and shows progress while busy", () => {
    render(<MigrationGate onMigrate={vi.fn()} busy={true} error={null} />);

    const button = screen.getByRole("button", { name: "Migrating…" });
    expect(button).toHaveProperty("disabled", true);
  });

  it("surfaces a migration error", () => {
    render(<MigrationGate onMigrate={vi.fn()} busy={false} error="disk full" />);

    expect(screen.getByRole("alert").textContent).toContain("disk full");
  });
});
