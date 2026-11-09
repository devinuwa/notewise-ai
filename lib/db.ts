import Dexie, { type Table } from "dexie";
import type { ExamBody } from "@/lib/exam/bodies";
import type { SpeechRate } from "@/lib/listen/rates";
import { titleCaseName } from "@/lib/name";
import type { FlaggedWord } from "@/lib/ocr/types";

export type PageStatus = "needs-review" | "digitized";
export type OcrMode = "cloud" | "on-device";
export type OcrStatus = "queued" | "reading" | "ready" | "error";

export interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  createdAt: number;
}

export interface NotePage {
  id: string;
  topicId: string;
  subjectId: string;
  imageBlob: Blob;
  rawOcrText: string;
  text: string;
  flaggedWords: FlaggedWord[];
  ocrProvider: string;
  status: PageStatus;
  createdAt: number;
  correctedAt?: number;
  driveFileId?: string;
  ocrError?: string;
  flagsFixed?: number;
  /** Small grayscale JPEG sent to the reader. The colour crop stays in imageBlob. */
  ocrBlob?: Blob;
  ocrHash?: string;
  ocrStatus?: OcrStatus;
  ocrBatchId?: string;
  preprocessMs?: number;
  uploadMs?: number;
  ocrMs?: number;
}

export interface OcrCacheRow {
  hash: string;
  rawOcrText: string;
  text: string;
  flaggedWords: FlaggedWord[];
  provider: string;
}

export interface ChatSource {
  pageId: string;
  topicId: string;
  subjectId: string;
  label: string;
}

export type QuizDifficulty = "mixed" | "easy" | "hard";
export type QuestionDifficulty = "easy" | "hard";

/** One checked question. sourceQuote was found in the notes before it was saved. */
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  topic: string;
  difficulty: QuestionDifficulty;
  sourceQuote: string;
  pageId?: string;
  topicId?: string;
  subjectId?: string;
}

export interface Quiz {
  id: string;
  subjectId: string;
  topicId?: string;
  difficulty: QuizDifficulty;
  requestedCount: number;
  questions: QuizQuestion[];
  createdAt: number;
  note?: string;
  /** Set when the quiz follows a past-paper pattern. The questions still come from the notes. */
  styleLabel?: string;
}

export interface AttemptAnswer {
  questionId: string;
  topic: string;
  correct: boolean;
}

export interface Attempt {
  id: string;
  quizId: string;
  takenAt: number;
  total: number;
  correct: number;
  answers: AttemptAnswer[];
}

/** A saved tutor turn. User rows are what Home counts as questions. */
export interface ChatMessage {
  id: string;
  role: "user" | "tutor";
  text: string;
  createdAt: number;
  subjectId?: string;
  sources?: ChatSource[];
}

/** One piece of a reviewed page, with the vector used for meaning search. */
export interface Chunk {
  id: string;
  pageId: string;
  topicId: string;
  subjectId: string;
  text: string;
  embedding: Float32Array;
  createdAt: number;
}

export type ExamSheetSource = "photo" | "pdf-text" | "pdf-ocr";
export type ExamPaperStatus = "reading" | "needs-review" | "ready";

/** One uploaded past paper. It is not a library note, and it is not indexed for search. */
export interface ExamPaper {
  id: string;
  examBody: ExamBody;
  subjectName: string;
  year: number;
  /** Off unless the student ticks the backup box. Export and any future Drive sync must obey this. */
  includeInDrive: boolean;
  status: ExamPaperStatus;
  createdAt: number;
}

export interface ExamSheet {
  id: string;
  paperId: string;
  pageNumber: number;
  imageBlob: Blob;
  rawOcrText: string;
  text: string;
  flaggedWords: FlaggedWord[];
  ocrProvider: string;
  ocrStatus: OcrStatus;
  source: ExamSheetSource;
  status: PageStatus;
  createdAt: number;
  flagsFixed?: number;
  ocrError?: string;
}

export interface ExamSample {
  question: string;
  options: string[];
}

export interface ExamProfile {
  id: string;
  paperId: string;
  examBody: ExamBody;
  subjectName: string;
  year: number;
  includeInDrive: boolean;
  optionCount: number;
  averageQuestionLength: number;
  questionTypes: {
    recall: number;
    calculation: number;
    comprehension: number;
    application: number;
  };
  topics: { topic: string; count: number }[];
  difficultyMix: { easy: number; hard: number };
  wordingPatterns: string[];
  samples: ExamSample[];
  createdAt: number;
}

export interface Settings {
  id: "local";
  name: string;
  aiConsent: boolean;
  ocrMode: OcrMode;
  examDate?: number;
  /** speechSynthesis voiceURI. Empty until the student picks one. */
  voiceURI?: string;
  speechRate?: SpeechRate;
  /** How many Live Tutor visits asked at least one question. */
  liveTutorSessions?: number;
}

class NoteWiseDB extends Dexie {
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  notePages!: Table<NotePage, string>;
  settings!: Table<Settings, string>;
  ocrCache!: Table<OcrCacheRow, string>;
  chunks!: Table<Chunk, string>;
  chatMessages!: Table<ChatMessage, string>;
  quizzes!: Table<Quiz, string>;
  attempts!: Table<Attempt, string>;
  examPapers!: Table<ExamPaper, string>;
  examSheets!: Table<ExamSheet, string>;
  examProfiles!: Table<ExamProfile, string>;

  constructor() {
    super("notewise");
    this.version(1).stores({
      subjects: "id, name, createdAt",
      topics: "id, subjectId, name",
      pages: "id, topicId, createdAt, driveFileId",
      chunks: "id, pageId, subjectId, topicId",
      quizzes: "id, subjectId, topicId, createdAt",
      attempts: "id, quizId, takenAt",
      examProfiles: "id, examBody, subject, createdAt",
      activities: "id, key",
      settings: "id",
    });
    // Version 2 runs inside IndexedDB's versionchange transaction, so the
    // rename and the removal of the old sample rows commit together.
    this.version(2)
      .stores({
        subjects: "id, name, createdAt",
        topics: "id, subjectId, createdAt",
        notePages: "id, topicId, subjectId, status, createdAt",
        settings: "id",
        pages: null,
        chunks: null,
        quizzes: null,
        attempts: null,
        examProfiles: null,
        activities: null,
      })
      .upgrade(async (tx) => {
        const rows = await tx.table("settings").toArray();
        for (const row of rows) {
          const legacy = row as { id?: string; name?: string; displayName?: string };
          await tx.table("settings").put({
            id: legacy.id || "local",
            name: titleCaseName(String(legacy.name || legacy.displayName || "")),
            aiConsent: false,
            ocrMode: "cloud",
          });
        }
        await tx.table("subjects").clear();
        await tx.table("topics").clear();
      });
    this.version(3).stores({
      subjects: "id, name, createdAt",
      topics: "id, subjectId, createdAt",
      notePages: "id, topicId, subjectId, status, createdAt",
      settings: "id",
      ocrCache: "hash",
      pages: null,
      chunks: null,
      quizzes: null,
      attempts: null,
      examProfiles: null,
      activities: null,
    });
    // Version 2 removed the unused chunks table. Version 4 creates the real one.
    this.version(4).stores({
      chunks: "id, pageId, topicId, subjectId, createdAt",
    });
    this.version(5).stores({
      chatMessages: "id, role, createdAt",
    });
    // Version 2 removed the unused quiz tables. Version 6 creates the real ones.
    this.version(6).stores({
      quizzes: "id, subjectId, topicId, createdAt",
      attempts: "id, quizId, takenAt",
    });
    // Version 2 dropped the unused examProfiles store. Version 7 creates the real past-paper tables.
    this.version(7).stores({
      examPapers: "id, examBody, subjectName, year, createdAt",
      examSheets: "id, paperId, pageNumber, status",
      examProfiles: "id, paperId, examBody, subjectName, createdAt",
    });
  }
}

let database: NoteWiseDB | null = null;

export function getDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("Storage is only available in the browser.");
  }
  if (!database) {
    database = new NoteWiseDB();
  }
  return database;
}

export async function clearAllData() {
  const current = getDb();
  await current.delete();
  database = null;
  await getDb().open();
}
