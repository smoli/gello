import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TitleBar } from "./TitleBar";
import { isMacOS } from "../lib/platform";

vi.mock("../lib/platform", () => ({ isMacOS: vi.fn().mockReturnValue(false) }));
// window controls call the Tauri window API — stub it out for these tests
vi.mock("../lib/window", () => ({
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  isWindowMaximized: vi.fn().mockResolvedValue(false),
  onWindowResized: vi.fn().mockResolvedValue(() => {}),
}));

beforeEach(() => vi.mocked(isMacOS).mockReturnValue(false));

describe("TitleBar", () => {
  it("renders the gello title with folder and branch", () => {
    render(<TitleBar root="/Users/x/gello/.gello" branch="main" />);
    expect(screen.getByText("gello - gello (main)")).toBeInTheDocument();
  });

  it("omits the branch when not a git repo", () => {
    render(<TitleBar root="/x/proj/.gello" branch={null} />);
    expect(screen.getByText("gello - proj")).toBeInTheDocument();
  });

  it("c0083: shows no dirty indicator when clean or absent", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        git={{ kind: "status", board_dirty: false, code_dirty: false }}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("c0083: shows a board-only dirty indicator distinct from a code one", () => {
    const { rerender } = render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        git={{ kind: "status", board_dirty: true, code_dirty: false }}
      />,
    );
    const boardDot = screen.getByRole("status");
    expect(boardDot).toHaveAccessibleName("Uncommitted board changes");
    expect(boardDot.className).toContain("titlebar-dirty-board");

    rerender(
      <TitleBar
        root="/x/.gello"
        branch="main"
        git={{ kind: "status", board_dirty: true, code_dirty: true }}
      />,
    );
    const codeDot = screen.getByRole("status");
    expect(codeDot).toHaveAccessibleName("Uncommitted changes (includes code)");
    expect(codeDot.className).toContain("titlebar-dirty-code");
  });

  // i0131: a git that can't answer used to render exactly like a clean
  // worktree, so the whole integration could be off with nothing to see.
  it("i0131: shows why git is unavailable, instead of looking clean", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        git={{ kind: "unavailable", message: "detected dubious ownership in repository at '/x'" }}
      />,
    );
    const marker = screen.getByRole("status");
    expect(marker).toHaveAccessibleName(
      "Git unavailable: detected dubious ownership in repository at '/x'",
    );
    expect(marker.className).toContain("titlebar-git-unavailable");
    // it is the dirty dot's corner, but not a dirty dot
    expect(marker.className).not.toContain("titlebar-dirty-board");
    expect(marker.className).not.toContain("titlebar-dirty-code");
  });

  it("i0131: stays quiet for a project that is not a git repo", () => {
    render(<TitleBar root="/x/.gello" branch={null} git={{ kind: "not_a_repo" }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("c0100: shows no runner indicator when the companion isn't running", () => {
    render(<TitleBar root="/x/.gello" branch="main" runner={null} />);
    expect(screen.queryByRole("button", { name: /Companion/ })).not.toBeInTheDocument();
  });

  // c0110: the runner corner offers Start when nothing is running. `updated` is
  // local time (the companion writes local, the app parses it as local), so the
  // fixture must be local — not the UTC of toISOString().
  function localNow(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  }
  const freshRunner = {
    status: "running" as const,
    ready: [],
    waiting: [],
    runs: [{ cardId: "c001", phase: "running" as const }],
    updated: localNow(),
    pickupDelay: 0,
    owned: [],
  };

  it("c0110: offers Start companion when no companion is running", () => {
    const onStartCompanion = vi.fn();
    render(
      <TitleBar root="/x/proj/.gello" branch="main" runner={null} onStartCompanion={onStartCompanion} />,
    );
    const start = screen.getByRole("button", { name: "Start companion" });
    fireEvent.click(start);
    expect(onStartCompanion).toHaveBeenCalledOnce();
    // and no status indicator alongside it
    expect(screen.queryByRole("button", { name: /Companion:/ })).not.toBeInTheDocument();
  });

  it("c0110: shows the indicator (not Start) while a companion is running — never both", () => {
    render(
      <TitleBar root="/x/.gello" branch="main" runner={freshRunner} onStartCompanion={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Companion:/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start companion" })).not.toBeInTheDocument();
  });

  it("c0110: offers Start again when the state file has gone stale", () => {
    const stale = {
      ...freshRunner,
      updated: "2000-01-01T00:00:00", // long past the stale window
      pickupDelay: 0,
      owned: [],
    };
    render(
      <TitleBar root="/x/.gello" branch="main" runner={stale} onStartCompanion={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Start companion" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Companion:/ })).not.toBeInTheDocument();
  });

  it("c0110: shows no Start action without an onStartCompanion handler", () => {
    render(<TitleBar root="/x/.gello" branch="main" runner={null} />);
    expect(screen.queryByRole("button", { name: "Start companion" })).not.toBeInTheDocument();
  });

  it("c0100: shows a runner indicator reflecting the companion status", () => {
    const { rerender } = render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{ status: "running", ready: [], waiting: [], runs: [{ cardId: "c001", phase: "running" }], updated: "", pickupDelay: 0, owned: [] }}
      />,
    );
    const icon = screen.getByRole("button", { name: "Companion: running (1 active)" });
    expect(icon.className).toContain("titlebar-runner-running");

    rerender(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{ status: "waiting", ready: [], waiting: ["c002"], runs: [], updated: "", pickupDelay: 0, owned: [] }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Companion: waiting for input" }).className,
    ).toContain("titlebar-runner-waiting");
  });

  it("c0100: clicking the runner icon reveals the active runs", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{
          status: "running",
          ready: [],
          waiting: [],
          runs: [
            { cardId: "c001", phase: "running" },
            { cardId: "c002", phase: "waiting-for-input" },
          ],
          updated: "",
          pickupDelay: 0,
          owned: [],
        }}
      />,
    );
    expect(screen.queryByRole("dialog", { name: "Companion runs" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Companion/ }));
    const popover = screen.getByRole("dialog", { name: "Companion runs" });
    expect(within(popover).getByText("c001")).toBeInTheDocument();
    expect(within(popover).getByText("waiting-for-input")).toBeInTheDocument();
  });

  // c0119: an explicit stop lives in the runs popover — unambiguous intent on
  // the surface that already lists the runs.
  it("c0119: stops the chosen run and no other from the popover", () => {
    const onStopRun = vi.fn();
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{
          status: "running",
          ready: [],
          waiting: [],
          runs: [
            { cardId: "c001", phase: "running" },
            { cardId: "c002", phase: "running" },
          ],
          updated: "",
          pickupDelay: 0,
          owned: [],
        }}
        onStopRun={onStopRun}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Companion/ }));
    const popover = screen.getByRole("dialog", { name: "Companion runs" });
    const stops = within(popover).getAllByRole("button", { name: /Stop run/ });
    expect(stops).toHaveLength(2);
    fireEvent.click(stops[0]);
    expect(onStopRun).toHaveBeenCalledExactlyOnceWith("c001");
  });

  it("c0119: shows no stop control without an onStopRun handler", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{ status: "running", ready: [], waiting: [], runs: [{ cardId: "c001", phase: "running" }], updated: "", pickupDelay: 0, owned: [] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Companion/ }));
    expect(screen.queryByRole("button", { name: /Stop run/ })).not.toBeInTheDocument();
  });

  it("c0119: offers no stop for a run that has already ended (aborted)", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{ status: "running", ready: [], waiting: [], runs: [{ cardId: "c001", phase: "aborted" }], updated: "", pickupDelay: 0, owned: [] }}
        onStopRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Companion/ }));
    expect(screen.queryByRole("button", { name: /Stop run/ })).not.toBeInTheDocument();
  });

  it("i0108: closes the runs popover when clicking outside it", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{ status: "running", ready: [], waiting: [], runs: [{ cardId: "c001", phase: "running" }], updated: "", pickupDelay: 0, owned: [] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Companion/ }));
    expect(screen.getByRole("dialog", { name: "Companion runs" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Companion runs" })).not.toBeInTheDocument();
  });

  it("i0108: keeps the runs popover open when clicking inside it", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{ status: "running", ready: [], waiting: [], runs: [{ cardId: "c001", phase: "running" }], updated: "", pickupDelay: 0, owned: [] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Companion/ }));
    const popover = screen.getByRole("dialog", { name: "Companion runs" });

    fireEvent.mouseDown(popover);
    expect(screen.getByRole("dialog", { name: "Companion runs" })).toBeInTheDocument();
  });

  it("i0037: renders the runs popover outside the clipping title area", () => {
    const { container } = render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={{ status: "running", ready: [], waiting: [], runs: [{ cardId: "c001", phase: "running" }], updated: "", pickupDelay: 0, owned: [] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Companion/ }));
    const popover = screen.getByRole("dialog", { name: "Companion runs" });
    // `.titlebar-left` has overflow:hidden for the caption ellipsis; a popover
    // nested inside it is clipped and never shows (the reported bug).
    const left = container.querySelector(".titlebar-left");
    expect(left?.contains(popover)).toBe(false);
  });

  // c0169: the AFK toggle — the app-side switch for the c0162 flag. It sits in
  // the runner corner and is offered whether or not a companion is running, so
  // AFK can be armed before starting one.

  it("c0169: shows the AFK toggle as off by default", () => {
    render(
      <TitleBar root="/x/.gello" branch="main" runner={null} onToggleAfk={vi.fn()} />,
    );
    const toggle = screen.getByRole("button", { name: /AFK mode/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle.className).not.toContain("titlebar-afk-on");
  });

  it("c0169: shows AFK on distinctly from off", () => {
    const { rerender } = render(
      <TitleBar root="/x/.gello" branch="main" afk={false} onToggleAfk={vi.fn()} />,
    );
    const off = screen.getByRole("button", { name: /AFK mode/ });
    const offLook = [off.className, off.textContent, off.getAttribute("aria-pressed")];

    rerender(<TitleBar root="/x/.gello" branch="main" afk onToggleAfk={vi.fn()} />);
    const on = screen.getByRole("button", { name: /AFK mode/ });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(on.className).toContain("titlebar-afk-on");
    expect([on.className, on.textContent, on.getAttribute("aria-pressed")]).not.toEqual(
      offLook,
    );
    expect(on.textContent).toContain("AFK");
  });

  it("c0169: toggling asks for the opposite state", () => {
    const onToggleAfk = vi.fn();
    const { rerender } = render(
      <TitleBar root="/x/.gello" branch="main" afk={false} onToggleAfk={onToggleAfk} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /AFK mode/ }));
    expect(onToggleAfk).toHaveBeenCalledExactlyOnceWith(true);

    onToggleAfk.mockClear();
    rerender(<TitleBar root="/x/.gello" branch="main" afk onToggleAfk={onToggleAfk} />);
    fireEvent.click(screen.getByRole("button", { name: /AFK mode/ }));
    expect(onToggleAfk).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("c0169: shows no AFK control without an onToggleAfk handler", () => {
    render(<TitleBar root="/x/.gello" branch="main" afk />);
    expect(screen.queryByRole("button", { name: /AFK mode/ })).not.toBeInTheDocument();
  });

  it("c0169: stays out of the runs popover's way while a companion runs", () => {
    render(
      <TitleBar
        root="/x/.gello"
        branch="main"
        runner={freshRunner}
        afk
        onToggleAfk={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Companion:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AFK mode/ })).toBeInTheDocument();
  });

  // c0170: the sign-off pile is the first thing to see on returning — the count
  // rides the title bar, so it shows whatever the board is filtered or scrolled
  // to.

  it("c0170: reports how many cards await sign-off", () => {
    render(<TitleBar root="/x/.gello" branch="main" signoffCount={3} />);
    const badge = screen.getByRole("status", { name: /3 cards awaiting sign-off/i });
    expect(badge.textContent).toContain("3");
  });

  it("c0170: names a single pending card in the singular", () => {
    render(<TitleBar root="/x/.gello" branch="main" signoffCount={1} />);
    expect(
      screen.getByRole("status", { name: /1 card awaiting sign-off/i }),
    ).toBeInTheDocument();
  });

  it("c0170: shows nothing when the check-list is clear", () => {
    render(<TitleBar root="/x/.gello" branch="main" signoffCount={0} />);
    expect(screen.queryByRole("status", { name: /sign-off/i })).not.toBeInTheDocument();
  });

  it("is a Tauri drag region", () => {
    const { container } = render(<TitleBar root="/x/.gello" branch={null} />);
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
  });

  // c0066: the fulltext search box now lives in the top bar

  it("shows no search box without an onSearch handler", () => {
    render(<TitleBar root="/x/.gello" branch={null} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("reports query changes and reflects the value", () => {
    const onSearch = vi.fn();
    render(
      <TitleBar root="/x/.gello" branch={null} search="foo" onSearch={onSearch} />,
    );
    const search = screen.getByRole("searchbox") as HTMLInputElement;
    expect(search.value).toBe("foo");

    fireEvent.change(search, { target: { value: "kanban" } });
    expect(onSearch).toHaveBeenCalledWith("kanban");
  });

  it("clears the query on Escape", () => {
    const onSearch = vi.fn();
    render(
      <TitleBar root="/x/.gello" branch={null} search="kanban" onSearch={onSearch} />,
    );
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("focuses the search box on Cmd/Ctrl+F", () => {
    render(<TitleBar root="/x/.gello" branch={null} search="" onSearch={vi.fn()} />);
    const search = screen.getByRole("searchbox");
    expect(search).not.toHaveFocus();

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    expect(search).toHaveFocus();
  });

  it("keeps the search box interactive (not a drag region)", () => {
    render(<TitleBar root="/x/.gello" branch={null} search="" onSearch={vi.fn()} />);
    expect(
      screen.getByRole("searchbox").hasAttribute("data-tauri-drag-region"),
    ).toBe(false);
  });

  // i0017: custom window controls on Windows/Linux, native chrome on macOS

  it("renders custom window controls off macOS", () => {
    vi.mocked(isMacOS).mockReturnValue(false);
    const { container } = render(<TitleBar root="/x/.gello" branch={null} />);
    expect(container.querySelector(".titlebar")).toHaveClass("titlebar-win");
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders NO window controls on macOS (native traffic lights)", () => {
    vi.mocked(isMacOS).mockReturnValue(true);
    const { container } = render(<TitleBar root="/x/.gello" branch={null} />);
    expect(container.querySelector(".titlebar")).toHaveClass("titlebar-mac");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
