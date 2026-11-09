/** Client helpers for service worker update checks. */

export async function checkForServiceWorkerUpdate() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false as const, reason: "This browser does not use a service worker." };
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return { ok: false as const, reason: "No service worker is registered on this device yet." };
    }
    await registration.update();
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "NoteWise could not check for updates right now." };
  }
}

export function reloadToApplyUpdate() {
  window.location.reload();
}
