import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("shows the gello placeholder until a board is loaded", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "gello" })).toBeInTheDocument();
    expect(screen.getByText(/no board loaded/i)).toBeInTheDocument();
  });
});
