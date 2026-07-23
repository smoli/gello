// c0128: OS notifications for companion parks. A thin seam over the Tauri
// notification plugin — a no-op outside a Tauri window (plain browser / tests),
// like window.ts. The transition detection that decides *when* to call this
// lives in companion.ts (newlyParkedIds) and is unit-tested there; this file is
// only the platform call.

/**
 * Fire one OS notification that a card has parked on a question. Permission is
 * requested lazily on the first call; if it is denied, nothing is shown and the
 * caller is unaffected (the needs-input badge still carries the signal). The
 * card id rides along in `extra`, so a click can route back to it.
 */
export async function notifyPark(cardId: string, title: string): Promise<void> {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (!granted) return;
    sendNotification({
      title: "gello — question waiting",
      body: `${cardId} — ${title}`,
      extra: { cardId },
    });
  } catch {
    // not inside a Tauri window, or the plugin is unavailable → no notification
  }
}

/**
 * Subscribe to notification clicks, routing the carried card id back to the
 * handler (the app focuses the window and opens that card). Returns an
 * unsubscribe function; a no-op outside Tauri.
 */
export async function onNotificationOpen(
  handler: (cardId: string) => void,
): Promise<() => void> {
  try {
    const { onAction } = await import("@tauri-apps/plugin-notification");
    const listener = await onAction((notification) => {
      const extra = notification.extra as { cardId?: string } | undefined;
      if (extra?.cardId) handler(extra.cardId);
    });
    return () => void listener.unregister();
  } catch {
    return () => {};
  }
}
