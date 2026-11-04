export type NoteStatus = "digitized" | "needs-review" | "backed-up" | "not-started";

export const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  digitized: "Digitized",
  "needs-review": "Needs review",
  "backed-up": "Backed up",
  "not-started": "Not started",
};
