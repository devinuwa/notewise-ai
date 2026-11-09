import {
  getDb,
  type ChatMessage,
  type ExamPaper,
  type ExamProfile,
  type ExamSheet,
  type NotePage,
  type Quiz,
  type Subject,
  type Topic,
} from "@/lib/db";
import { downloadBlob, downloadText, findAppFolder, listManifests } from "@/lib/drive/api";
import { DriveError } from "@/lib/drive/errors";
import { ensureDriveToken } from "@/lib/drive/gis";
import { parseManifest } from "@/lib/drive/manifest";
import type { SpeechRate } from "@/lib/listen/rates";
import { isSpeechRate } from "@/lib/listen/rates";
import { DRIVE_FOLDER_NAME, type NoteWiseManifest, type RestoreMode } from "@/lib/drive/types";

function stamp(page: { correctedAt?: number; createdAt: number }) {
  return page.correctedAt ?? page.createdAt;
}

function asPage(row: NoteWiseManifest["notePages"][number], imageBlob?: Blob): NotePage {
  return {
    id: row.id,
    topicId: row.topicId,
    subjectId: row.subjectId,
    imageBlob: imageBlob ?? new Blob(),
    rawOcrText: row.rawOcrText ?? "",
    text: row.text ?? "",
    flaggedWords: Array.isArray(row.flaggedWords) ? row.flaggedWords : [],
    ocrProvider: row.ocrProvider ?? "",
    status: row.status === "digitized" ? "digitized" : "needs-review",
    createdAt: row.createdAt,
    correctedAt: row.correctedAt,
    driveFileId: row.photoFileId ?? row.driveFileId,
    flagsFixed: row.flagsFixed,
    ocrError: row.ocrError,
  };
}

async function loadPhoto(token: string, page: NoteWiseManifest["notePages"][number]) {
  const photoId = page.photoFileId ?? (page.driveFileId && !page.driveFileId.startsWith("manifest:") ? page.driveFileId : "");
  if (!photoId) return new Blob();
  try {
    return await downloadBlob(token, photoId);
  } catch {
    return new Blob();
  }
}

export async function listDriveBackups() {
  const token = await ensureDriveToken();
  const settings = await getDb().settings.get("local");
  const folderId = await findAppFolder(token.accessToken, DRIVE_FOLDER_NAME, settings?.driveFolderId);
  if (settings?.name) {
    await getDb().settings.put({ ...settings, driveFolderId: folderId, id: "local" });
  }
  const files = await listManifests(token.accessToken, folderId);
  return { folderId, files };
}

export async function restoreFromDrive(fileId: string, mode: RestoreMode, onCaption?: (caption: string) => void) {
  const token = await ensureDriveToken();
  onCaption?.("Downloading the backup…");
  const raw = await downloadText(token.accessToken, fileId);
  const manifest = parseManifest(raw);
  const db = getDb();

  if (mode === "replace") {
    onCaption?.("Replacing notes on this device…");
    // Dexie accepts a table array when clearing many stores at once.
    await db.transaction(
      "rw",
      [
        db.subjects,
        db.topics,
        db.notePages,
        db.quizzes,
        db.chatMessages,
        db.examPapers,
        db.examSheets,
        db.examProfiles,
        db.chunks,
      ],
      async () => {
        await Promise.all([
          db.subjects.clear(),
          db.topics.clear(),
          db.notePages.clear(),
          db.quizzes.clear(),
          db.chatMessages.clear(),
          db.examPapers.clear(),
          db.examSheets.clear(),
          db.examProfiles.clear(),
          db.chunks.clear(),
        ]);
      },
    );
  }

  onCaption?.("Reading subjects and topics…");
  await mergeSubjects(manifest.subjects as Subject[], mode);
  await mergeTopics(manifest.topics as Topic[], mode);

  onCaption?.("Reading pages…");
  const localPages = await db.notePages.toArray();
  const localById = new Map(localPages.map((page) => [page.id, page]));
  for (const remote of manifest.notePages) {
    const local = localById.get(remote.id);
    if (local && mode === "merge" && stamp(local) > stamp(remote)) {
      // Newer local edit wins. Never overwrite without asking — Merge keeps it.
      continue;
    }
    const imageBlob =
      local && local.imageBlob.size > 0 && !(remote.photoFileId || remote.driveFileId)
        ? local.imageBlob
        : await loadPhoto(token.accessToken, remote);
    const next = asPage(remote, imageBlob.size > 0 ? imageBlob : local?.imageBlob);
    if (local?.imageBlob && local.imageBlob.size > 0 && next.imageBlob.size === 0) {
      next.imageBlob = local.imageBlob;
    }
    await db.notePages.put(next);
  }

  onCaption?.("Reading quizzes…");
  for (const rawQuiz of manifest.quizzes) {
    const quiz = rawQuiz as Quiz;
    if (!quiz?.id || !Array.isArray(quiz.questions)) continue;
    if (mode === "merge") {
      const local = await db.quizzes.get(quiz.id);
      if (local && local.createdAt > quiz.createdAt) continue;
    }
    await db.quizzes.put(quiz);
  }

  onCaption?.("Reading tutor chat…");
  for (const rawChat of manifest.chatMessages ?? []) {
    const message = rawChat as ChatMessage;
    if (!message?.id || (message.role !== "user" && message.role !== "tutor")) continue;
    if (mode === "merge") {
      const local = await db.chatMessages.get(message.id);
      if (local && local.createdAt > message.createdAt) continue;
    }
    await db.chatMessages.put({
      id: message.id,
      role: message.role,
      text: message.text ?? "",
      createdAt: message.createdAt,
      subjectId: message.subjectId,
      sources: message.sources,
    });
  }

  onCaption?.("Reading exam backups…");
  for (const rawPaper of manifest.examPapers) {
    const paper = rawPaper as ExamPaper;
    if (!paper?.id) continue;
    if (mode === "merge") {
      const local = await db.examPapers.get(paper.id);
      if (local && local.createdAt > paper.createdAt) continue;
    }
    await db.examPapers.put(paper);
  }
  for (const rawSheet of manifest.examSheets) {
    const sheet = rawSheet as ExamSheet;
    if (!sheet?.id) continue;
    if (mode === "merge") {
      const local = await db.examSheets.get(sheet.id);
      if (local && local.createdAt > sheet.createdAt) continue;
    }
    await db.examSheets.put({
      ...sheet,
      imageBlob: sheet.imageBlob ?? new Blob(),
    });
  }
  for (const rawProfile of manifest.examProfiles) {
    const profile = rawProfile as ExamProfile;
    if (!profile?.id) continue;
    if (mode === "merge") {
      const local = await db.examProfiles.get(profile.id);
      if (local && local.createdAt > profile.createdAt) continue;
    }
    await db.examProfiles.put(profile);
  }

  if (manifest.settings?.name) {
    const existing = await db.settings.get("local");
    await db.settings.put({
      id: "local",
      name: existing?.name || manifest.settings.name,
      aiConsent: existing?.aiConsent ?? manifest.settings.aiConsent ?? false,
      ocrMode: existing?.ocrMode ?? manifest.settings.ocrMode ?? "cloud",
      examDate: existing?.examDate ?? manifest.settings.examDate,
      voiceURI: existing?.voiceURI ?? manifest.settings.voiceURI,
      speechRate:
        existing?.speechRate ??
        (isSpeechRate(manifest.settings.speechRate) ? (manifest.settings.speechRate as SpeechRate) : undefined),
      driveFolderId: existing?.driveFolderId,
      driveManifestId: fileId,
      liveTutorSessions: existing?.liveTutorSessions,
    });
  }

  onCaption?.("Restore finished");
  return { pages: manifest.notePages.length, subjects: manifest.subjects.length };
}

async function mergeSubjects(rows: Subject[], mode: RestoreMode) {
  const db = getDb();
  for (const subject of rows) {
    if (!subject?.id || !subject.name) continue;
    if (mode === "merge") {
      const local = await db.subjects.get(subject.id);
      if (local && local.createdAt > subject.createdAt) continue;
      if (local) {
        await db.subjects.put({ ...local, name: subject.name, color: subject.color });
        continue;
      }
    }
    await db.subjects.put(subject);
  }
}

async function mergeTopics(rows: Topic[], mode: RestoreMode) {
  const db = getDb();
  for (const topic of rows) {
    if (!topic?.id || !topic.name) continue;
    if (mode === "merge") {
      const local = await db.topics.get(topic.id);
      if (local && local.createdAt > topic.createdAt) continue;
      if (local) {
        await db.topics.put({ ...local, name: topic.name, subjectId: topic.subjectId });
        continue;
      }
    }
    await db.topics.put(topic);
  }
}

export function assertRestoreChoice(mode: RestoreMode | ""): asserts mode is RestoreMode {
  if (mode !== "merge" && mode !== "replace") {
    throw new DriveError("Choose Merge or Replace before restoring.");
  }
}
