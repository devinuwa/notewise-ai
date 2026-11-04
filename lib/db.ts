import Dexie, { type Table } from "dexie";
import { titleCaseName } from "@/lib/name";
import type { FlaggedWord } from "@/lib/ocr/types";

export type PageStatus = "needs-review" | "digitized";
export type OcrMode = "cloud" | "on-device";

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
}

export interface Settings {
  id: "local";
  name: string;
  aiConsent: boolean;
  ocrMode: OcrMode;
  examDate?: number;
}

class NoteWiseDB extends Dexie {
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  notePages!: Table<NotePage, string>;
  settings!: Table<Settings, string>;

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
