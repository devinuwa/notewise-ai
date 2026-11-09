/**
 * Public stats for the About band on the landing page.
 * Placeholder figures for the pitch layout — swap later if you publish real numbers.
 */
export type LandingStat = {
  label: string;
  value: string;
};

export const LANDING_STATS: LandingStat[] = [
  { label: "Pages digitised in class tests", value: "120" },
  { label: "Students who tried the prototype", value: "8" },
  { label: "Subjects practised in demos", value: "5" },
];
