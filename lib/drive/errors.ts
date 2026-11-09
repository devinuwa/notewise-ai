export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveError";
  }
}

function currentOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Map network and Drive API failures to short student-facing lines. */
export function friendlyDriveError(caught: unknown) {
  if (caught instanceof DriveError) return caught.message;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You look offline. Connect to the internet and try again.";
  }
  if (caught instanceof TypeError) {
    return "You look offline. Connect to the internet and try again.";
  }

  const message = caught instanceof Error ? caught.message : String(caught ?? "");
  const lower = message.toLowerCase();
  const origin = currentOrigin();

  if (/popup_blocked|popup blocked|blocked by the user|window\.open/i.test(message)) {
    return "The Google sign-in window was blocked. Allow popups for this site, then Connect Google Drive again.";
  }
  if (/popup_closed|closed before/i.test(message)) {
    return "Google Drive sign-in closed before it finished. Leave the Google window open until it closes itself (even if it looks blank), click Continue on any unverified-app warning, then try Connect again.";
  }
  if (/access_denied|permission was denied|insufficient|permission/i.test(message)) {
    return "Google Drive permission was denied. Connect again and allow NoteWise to save files it creates.";
  }
  if (/unverified|hasn.?t verified|not verified|app is currently being tested/i.test(message)) {
    return 'Google shows "unverified app" while NoteWise is in Testing. Click Continue (not Back to safety). Only do this if you are a listed test user.';
  }
  if (/origin|redirect_uri|javascript origin|unauthorized.?client|invalid.?client/i.test(message)) {
    return origin
      ? `This site origin is not allowed for Google sign-in yet. In Google Cloud → Credentials → your Web client, add Authorised JavaScript origin: ${origin}`
      : "This site origin is not allowed for Google sign-in yet. Add this page's origin under Authorised JavaScript origins in Google Cloud.";
  }
  if (/401|invalid.?token|expired/i.test(lower)) {
    return "Google Drive access expired. Connect Google Drive again.";
  }
  if (/403/i.test(message)) {
    if (/quota|storage/i.test(message)) {
      return "Google Drive is full. Free some space, then try again.";
    }
    return "Google Drive permission was denied. Connect again and allow NoteWise to save files it creates.";
  }
  if (/404/i.test(message)) {
    return "That Drive backup could not be found. It may have been moved or deleted.";
  }
  if (/429|rate/i.test(lower)) {
    return "Google Drive is busy. Wait a moment and try again.";
  }
  if (/quota|storage/i.test(lower)) {
    return "Google Drive is full. Free some space, then try again.";
  }
  return "Google Drive could not finish that step. Try again.";
}

export function readClientId() {
  return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
}

export function driveConfigured() {
  return readClientId().length > 0;
}
