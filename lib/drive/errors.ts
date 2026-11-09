export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveError";
  }
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
  const message = caught instanceof Error ? caught.message : "";
  if (/401|invalid.?token|expired/i.test(message)) {
    return "Google Drive access expired. Connect Google Drive again.";
  }
  if (/403|insufficient|permission/i.test(message)) {
    return "Google Drive permission was denied. Connect again and allow NoteWise to save files it creates.";
  }
  if (/404/i.test(message)) {
    return "That Drive backup could not be found. It may have been moved or deleted.";
  }
  if (/429|rate/i.test(message)) {
    return "Google Drive is busy. Wait a moment and try again.";
  }
  if (/quota|storage/i.test(message)) {
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
