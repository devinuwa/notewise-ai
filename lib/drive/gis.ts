"use client";

import { DriveError, driveConfigured, readClientId } from "@/lib/drive/errors";
import { DRIVE_SCOPE, type DriveToken } from "@/lib/drive/types";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void;
};

type GisOauth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
};

type GisAccounts = { oauth2: GisOauth2 };

declare global {
  interface Window {
    google?: { accounts?: GisAccounts };
  }
}

let scriptPromise: Promise<void> | null = null;
/** Access token lives in memory only. A refresh of the tab clears it. */
let memoryToken: DriveToken | null = null;
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function getDriveToken() {
  if (!memoryToken) return null;
  if (Date.now() >= memoryToken.expiresAt) {
    memoryToken = null;
    publish();
    return null;
  }
  return memoryToken;
}

export function subscribeDriveToken(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearDriveToken() {
  memoryToken = null;
  publish();
}

function loadGisScript() {
  if (typeof window === "undefined") return Promise.reject(new DriveError("Drive only works in the browser."));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-notewise-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new DriveError("Google sign-in could not load. Check the connection.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.notewiseGis = "1";
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new DriveError("Google sign-in could not load. Check the connection."));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

function setToken(accessToken: string, expiresIn: number) {
  // Refresh a minute early so a backup does not start on a dead token.
  const ttl = Math.max(30, (expiresIn || 3600) - 60) * 1000;
  memoryToken = { accessToken, expiresAt: Date.now() + ttl };
  publish();
}

/** Open the Google consent popup. Token is kept in memory only. */
export async function connectDrive(prompt: "" | "consent" = "consent"): Promise<DriveToken> {
  if (!driveConfigured()) {
    throw new DriveError("Google Drive is not set up on this computer yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new DriveError("You look offline. Connect to the internet and try again.");
  }
  await loadGisScript();
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) throw new DriveError("Google sign-in could not start on this browser.");

  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: readClientId(),
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new DriveError(
              response.error === "access_denied"
                ? "Google Drive permission was denied. Connect again and allow NoteWise to save files it creates."
                : "Google Drive access expired. Connect Google Drive again.",
            ),
          );
          return;
        }
        setToken(response.access_token, response.expires_in ?? 3600);
        resolve(memoryToken!);
      },
      error_callback: (error) => {
        if (error.type === "popup_closed") {
          reject(new DriveError("Google Drive sign-in was closed before it finished."));
          return;
        }
        reject(new DriveError("Google Drive permission was denied. Connect again and allow NoteWise to save files it creates."));
      },
    });
    client.requestAccessToken({ prompt });
  });
}

/** Ensure a live token. Reuses memory when still valid. */
export async function ensureDriveToken() {
  const current = getDriveToken();
  if (current) return current;
  try {
    // Empty prompt reuses a prior grant when Google still remembers this app.
    return await connectDrive("");
  } catch {
    return connectDrive("consent");
  }
}

export async function disconnectDrive() {
  const token = memoryToken?.accessToken;
  clearDriveToken();
  if (!token) return;
  try {
    await loadGisScript();
    const oauth = window.google?.accounts?.oauth2;
    if (oauth?.revoke) {
      await new Promise<void>((resolve) => oauth.revoke(token, () => resolve()));
      return;
    }
  } catch {
    // Fall through to the HTTP revoke endpoint.
  }
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  } catch {
    // Token is already cleared locally.
  }
}
