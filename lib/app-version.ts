/** Build-time app version for Settings > About. */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

/** Short git SHA when available (Vercel / local build). */
export const APP_COMMIT = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "dev";

export function appVersionLabel() {
  return APP_COMMIT && APP_COMMIT !== "dev" ? `${APP_VERSION} (${APP_COMMIT})` : APP_VERSION;
}
