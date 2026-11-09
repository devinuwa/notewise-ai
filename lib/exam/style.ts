import type { ExamProfile } from "@/lib/db";
import type { ExamStyle } from "@/lib/practice/check";

export function examStyleLabel(examBody: string) {
  return `Practice question in the style of ${examBody}, not an official past question`;
}

/** Few-shot style only. The quiz checker still requires a quote from the student's notes. */
export function styleFromProfile(profile: ExamProfile): ExamStyle {
  const types = profile.questionTypes;
  return {
    examBody: profile.examBody,
    year: profile.year,
    subjectName: profile.subjectName,
    optionCount: profile.optionCount,
    averageQuestionLength: profile.averageQuestionLength,
    questionTypes: `recall ${types.recall}, calculation ${types.calculation}, comprehension ${types.comprehension}, application ${types.application}`,
    difficultyMix: {
      easy: profile.difficultyMix.easy,
      hard: profile.difficultyMix.hard,
    },
    wordingPatterns: profile.wordingPatterns.slice(0, 6),
    samples: profile.samples.slice(0, 8).map((sample) => ({
      question: sample.question.slice(0, 400),
      options: sample.options.slice(0, 6),
    })),
  };
}
