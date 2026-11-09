/**
 * Optional public stats for the About band.
 * Leave empty so nothing shows. Fill only with numbers you can stand behind.
 *
 * Example:
 * export const LANDING_STATS = [
 *   { label: "Pages digitised in class tests", value: "120" },
 *   { label: "Students who tried the prototype", value: "8" },
 * ];
 */
export type LandingStat = {
  label: string;
  value: string;
};

export const LANDING_STATS: LandingStat[] = [];
