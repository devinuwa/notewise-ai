/**
 * Tracks in-page work that must not be interrupted by a PWA reload:
 * unsaved edits, OCR jobs, and an active quiz.
 */

const keys = new Set<string>();
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function setSessionBusy(key: string, busy: boolean) {
  const before = keys.size;
  if (busy) keys.add(key);
  else keys.delete(key);
  if (keys.size !== before) publish();
}

export function isSessionBusy() {
  return keys.size > 0;
}

export function sessionBusySnapshot() {
  return keys.size > 0;
}

export function subscribeSessionBusy(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** OCR rows in Dexie that are still mid-job. */
export async function hasActiveOcrJob() {
  if (typeof indexedDB === "undefined") return false;
  try {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    const pages = await db.notePages
      .filter((page) => page.ocrStatus === "queued" || page.ocrStatus === "reading")
      .count();
    if (pages > 0) return true;
    const sheets = await db.examSheets
      .filter((sheet) => sheet.ocrStatus === "queued" || sheet.ocrStatus === "reading")
      .count();
    return sheets > 0;
  } catch {
    return false;
  }
}

export async function isReloadBlocked() {
  if (isSessionBusy()) return true;
  return hasActiveOcrJob();
}
