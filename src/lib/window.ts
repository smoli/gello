// c0059: start a native window drag from a background surface. No-op outside
// Tauri (plain browser / tests). Dynamic import keeps the Tauri API out of
// the web bundle path.

export async function startWindowDrag(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    // not running inside a Tauri window
  }
}

// c0128: raise and focus the window — used when an OS notification for a
// parked question is clicked, so the app comes forward on the answer. No-op
// outside Tauri.
export async function focusWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const window = getCurrentWindow();
    await window.unminimize();
    await window.setFocus();
  } catch {
    /* not in Tauri */
  }
}

// i0017: custom window controls for the frameless Windows/Linux chrome. All
// no-op / safe defaults outside a Tauri window (plain browser / tests).

export async function minimizeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  } catch {
    /* not in Tauri */
  }
}

export async function toggleMaximizeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  } catch {
    /* not in Tauri */
  }
}

export async function closeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch {
    /* not in Tauri */
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await getCurrentWindow().isMaximized();
  } catch {
    return false;
  }
}

/** Subscribe to window resize (to keep the maximize/restore icon in sync).
 *  Returns an unsubscribe function; a no-op outside Tauri. */
export async function onWindowResized(
  handler: () => void,
): Promise<() => void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await getCurrentWindow().onResized(() => handler());
  } catch {
    return () => {};
  }
}
