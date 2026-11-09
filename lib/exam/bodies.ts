export const examBodies = ["JAMB", "WAEC", "NECO", "Junior WAEC", "School exam"] as const;

export type ExamBody = (typeof examBodies)[number];

export const EXAM_YEAR_MIN = 1990;
export const EXAM_YEAR_MAX = 2030;
export const EXAM_PAGE_CAP = 6;
export const EXAM_TEXT_CAP = 14_000;

export function isExamBody(value: string): value is ExamBody {
  return (examBodies as readonly string[]).includes(value);
}
