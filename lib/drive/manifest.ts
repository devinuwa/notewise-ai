import { getDb, type ChatMessage, type NotePage, type Quiz } from "@/lib/db";
import type { ManifestPage, NoteWiseManifest } from "@/lib/drive/types";

function realDriveFileId(value?: string) {
  // Skip synthetic markers used only for local BACKED UP chips.
  if (!value || value.startsWith("manifest:")) return undefined;
  return value;
}

function pageMeta(page: NotePage, photoFileId?: string): ManifestPage {
  const photoId = photoFileId ?? realDriveFileId(page.driveFileId);
  return {
    id: page.id,
    topicId: page.topicId,
    subjectId: page.subjectId,
    rawOcrText: page.rawOcrText,
    text: page.text,
    flaggedWords: page.flaggedWords,
    ocrProvider: page.ocrProvider,
    status: page.status,
    createdAt: page.createdAt,
    correctedAt: page.correctedAt,
    driveFileId: photoId,
    flagsFixed: page.flagsFixed,
    ocrError: page.ocrError,
    photoFileId: photoId,
  };
}

function quizPlain(quiz: Quiz) {
  return {
    id: quiz.id,
    subjectId: quiz.subjectId,
    topicId: quiz.topicId,
    difficulty: quiz.difficulty,
    requestedCount: quiz.requestedCount,
    questions: quiz.questions,
    createdAt: quiz.createdAt,
    note: quiz.note,
    styleLabel: quiz.styleLabel,
  };
}

function chatPlain(message: ChatMessage) {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt,
    subjectId: message.subjectId,
    sources: message.sources,
  };
}

/** Build the Drive JSON. Photos stay out unless the student ticked Include photos. */
export async function buildManifest(includePhotos: boolean, photoIds: Record<string, string> = {}) {
  const db = getDb();
  const settings = await db.settings.get("local");
  const examPapers = (await db.examPapers.toArray()).filter((paper) => paper.includeInDrive);
  const sharedIds = new Set(examPapers.map((paper) => paper.id));
  const examSheets = (await db.examSheets.toArray())
    .filter((sheet) => sharedIds.has(sheet.paperId))
    .map((sheet) => ({
      id: sheet.id,
      paperId: sheet.paperId,
      pageNumber: sheet.pageNumber,
      rawOcrText: sheet.rawOcrText,
      text: sheet.text,
      flaggedWords: sheet.flaggedWords,
      ocrProvider: sheet.ocrProvider,
      ocrStatus: sheet.ocrStatus,
      source: sheet.source,
      status: sheet.status,
      createdAt: sheet.createdAt,
      flagsFixed: sheet.flagsFixed,
      ocrError: sheet.ocrError,
    }));
  const examProfiles = (await db.examProfiles.toArray()).filter(
    (profile) => profile.includeInDrive && sharedIds.has(profile.paperId),
  );
  const pages = await db.notePages.toArray();

  const manifest: NoteWiseManifest = {
    app: "NoteWise",
    version: 1,
    exportedAt: new Date().toISOString(),
    includePhotos,
    settings: settings
      ? {
          name: settings.name,
          aiConsent: settings.aiConsent,
          ocrMode: settings.ocrMode,
          examDate: settings.examDate,
          voiceURI: settings.voiceURI,
          speechRate: settings.speechRate,
          tutorLanguage: settings.tutorLanguage,
        }
      : null,
    subjects: await db.subjects.toArray(),
    topics: await db.topics.toArray(),
    notePages: pages.map((page) => pageMeta(page, photoIds[page.id])),
    quizzes: (await db.quizzes.toArray()).map(quizPlain),
    chatMessages: (await db.chatMessages.toArray()).map(chatPlain),
    examPapers,
    examSheets,
    examProfiles,
  };
  return manifest;
}

export function parseManifest(raw: string): NoteWiseManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That Drive file is not a NoteWise backup.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("That Drive file is not a NoteWise backup.");
  }
  const record = parsed as Partial<NoteWiseManifest>;
  if (record.app !== "NoteWise" || !Array.isArray(record.subjects) || !Array.isArray(record.notePages)) {
    throw new Error("That Drive file is not a NoteWise backup.");
  }
  return {
    app: "NoteWise",
    version: 1,
    exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
    includePhotos: Boolean(record.includePhotos),
    settings: record.settings ?? null,
    subjects: record.subjects,
    topics: Array.isArray(record.topics) ? record.topics : [],
    notePages: record.notePages,
    quizzes: Array.isArray(record.quizzes) ? record.quizzes : [],
    chatMessages: Array.isArray(record.chatMessages) ? record.chatMessages : [],
    examPapers: Array.isArray(record.examPapers) ? record.examPapers : [],
    examSheets: Array.isArray(record.examSheets) ? record.examSheets : [],
    examProfiles: Array.isArray(record.examProfiles) ? record.examProfiles : [],
  };
}
