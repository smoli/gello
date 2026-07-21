// gello-companion dashboard shell (c0112): the thin terminal I/O layer.
//
// Raw ANSI, no dependency. This owns setup/restore, key input, resize and the
// redraw loop; what to draw is `composeFrame`'s job. The terminal is reached
// only through the `Screen` interface, so the shell's behaviour (Ctrl-C
// restores, a resize re-lays out, arrows switch cards) is testable without
// driving a real terminal.

import { composeFrame, cycleCard, decodeKey, type DashboardState, type Size } from "./tui-frame.ts";

/** The terminal, reduced to what the dashboard needs. */
export interface Screen {
  size(): Size;
  write(text: string): void;
  /** Enter the alternate buffer, hide the cursor, start raw key input. */
  setup(): void;
  /** Undo all of that — must leave the terminal exactly as it was found. */
  restore(): void;
  onKey(handler: (sequence: string) => void): void;
  onResize(handler: () => void): void;
}

/**
 * One frame as a single escape-code string: home the cursor, then clear each
 * line as it is written. Writing the whole frame in one call is what keeps a
 * hand-rolled renderer flicker-free — and clearing per line means a shorter
 * frame can't leave stale text behind.
 */
export function frameToAnsi(lines: string[]): string {
  return `\x1b[H${lines.map((line) => `\x1b[2K${line}`).join("\r\n")}`;
}

/** Everything the dashboard shows except the view state it owns itself. */
export type Snapshot = Omit<DashboardState, "selected" | "collapsed">;

export class Dashboard {
  private selected: string | null = null;
  private collapsed = false;
  private stopped = false;

  constructor(
    private readonly screen: Screen,
    /** Called with the selected card so the pane can follow the selection. */
    private readonly snapshot: (selected: string | null) => Snapshot,
    /** Cards that currently have a pane, in a stable order. */
    private readonly cards: () => string[],
    /** Called when the user asks to quit (Ctrl-C). */
    private readonly quit: () => void,
  ) {}

  start(): void {
    this.screen.setup();
    this.screen.onKey((sequence) => this.handleKey(sequence));
    this.screen.onResize(() => this.draw());
    this.draw();
  }

  /** Restore the terminal. Safe to call more than once (exit paths overlap). */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.screen.restore();
  }

  /** Redraw from the current snapshot. Called on a tick, on state changes and
   *  on resize; the frame is always composed for the terminal's current size. */
  draw(): void {
    if (this.stopped) return;
    const cards = this.cards();
    // keep the selection valid as runs come and go
    if (this.selected === null || !cards.includes(this.selected)) {
      this.selected = cards[0] ?? null;
    }
    const state: DashboardState = {
      ...this.snapshot(this.selected),
      selected: this.selected,
      collapsed: this.collapsed,
    };
    this.screen.write(frameToAnsi(composeFrame(state, this.screen.size())));
  }

  private handleKey(sequence: string): void {
    const action = decodeKey(sequence);
    if (action === null) return; // read-only: unknown keys do nothing at all
    if (action === "quit") {
      this.stop();
      this.quit();
      return;
    }
    if (action === "toggle") {
      this.collapsed = !this.collapsed;
    } else {
      this.selected = cycleCard(this.cards(), this.selected, action === "next" ? 1 : -1);
    }
    this.draw();
  }
}

/**
 * The terminal's size, with a sane fallback. A terminal does not always know
 * its own: a pty with no window size reports 0, and `?? 80` does not catch a
 * zero — which composes a frame of no rows and draws an empty screen.
 */
export function terminalSize(stream: { columns?: number; rows?: number }): Size {
  const positive = (value: number | undefined, fallback: number) =>
    typeof value === "number" && value > 0 ? value : fallback;
  return { columns: positive(stream.columns, 80), rows: positive(stream.rows, 24) };
}

/** The real terminal. Kept free of logic so it needs no test of its own. */
export function nodeScreen(
  stdout: NodeJS.WriteStream,
  stdin: NodeJS.ReadStream,
): Screen {
  return {
    size: () => terminalSize(stdout),
    write: (text) => void stdout.write(text),
    setup() {
      stdout.write("\x1b[?1049h\x1b[?25l"); // alternate buffer, cursor hidden
      stdin.setRawMode?.(true);
      stdin.resume();
      stdin.setEncoding("utf8");
    },
    restore() {
      stdin.setRawMode?.(false);
      stdin.pause();
      stdout.write("\x1b[?25h\x1b[?1049l"); // cursor back, original buffer back
    },
    onKey: (handler) => void stdin.on("data", (chunk: string) => handler(chunk)),
    onResize: (handler) => void stdout.on("resize", handler),
  };
}
