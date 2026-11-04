export const SUBJECT_SUGGESTIONS = [
  "Mathematics",
  "English Language",
  "Biology",
  "Chemistry",
  "Physics",
  "Government",
  "Economics",
  "Literature",
  "Civic Education",
  "Basic Science",
  "Agricultural Science",
  "Geography",
  "Commerce",
  "Financial Accounting",
  "Further Mathematics",
  "CRS",
  "IRS",
] as const;

/** Brand colours, in the order a new subject takes the next one. */
export const SUBJECT_COLOURS = ["#E53927", "#8BB2DE", "#F5B726", "#E97B77", "#3D5F58"] as const;

export function nextSubjectColour(existingCount: number) {
  return SUBJECT_COLOURS[existingCount % SUBJECT_COLOURS.length];
}

export function canonicalSubjectName(raw: string) {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const known = SUBJECT_SUGGESTIONS.find((name) => name.toLowerCase() === trimmed.toLowerCase());
  return known ?? trimmed;
}
