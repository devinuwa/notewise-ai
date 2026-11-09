import { getDb, type ExamPaper, type ExamProfile, type ExamSheet, type ExamSheetSource, type OcrStatus } from "@/lib/db";
import type { ExamBody } from "@/lib/exam/bodies";
import type { FlaggedWord } from "@/lib/ocr/types";

export type NewExamSheet = {
  pageNumber: number;
  imageBlob: Blob;
  text: string;
  rawOcrText: string;
  source: ExamSheetSource;
  ocrStatus: OcrStatus;
  ocrProvider: string;
};

export type SheetDraft = {
  text: string;
  flaggedWords: FlaggedWord[];
  flagsFixed: number;
};

const emptyBlob = () => new Blob([], { type: "application/octet-stream" });

export function blankSheetBlob() {
  return emptyBlob();
}

/** Save the paper and its pages together. Nothing here is written into the note library. */
export async function saveNewPaper(input: {
  examBody: ExamBody;
  subjectName: string;
  year: number;
  includeInDrive: boolean;
  sheets: NewExamSheet[];
}) {
  const db = getDb();
  const paperId = crypto.randomUUID();
  const now = Date.now();
  const waiting = input.sheets.some((sheet) => sheet.ocrStatus === "queued" || sheet.ocrStatus === "reading");
  const paper: ExamPaper = {
    id: paperId,
    examBody: input.examBody,
    subjectName: input.subjectName,
    year: input.year,
    includeInDrive: input.includeInDrive,
    status: waiting ? "reading" : "needs-review",
    createdAt: now,
  };
  const sheets: ExamSheet[] = input.sheets.map((sheet) => ({
    id: crypto.randomUUID(),
    paperId,
    pageNumber: sheet.pageNumber,
    imageBlob: sheet.imageBlob.size > 0 ? sheet.imageBlob : emptyBlob(),
    rawOcrText: sheet.rawOcrText,
    text: sheet.text,
    flaggedWords: [],
    ocrProvider: sheet.ocrProvider,
    ocrStatus: sheet.ocrStatus,
    source: sheet.source,
    status: "needs-review",
    createdAt: now,
  }));
  await db.transaction("rw", db.examPapers, db.examSheets, async () => {
    await db.examPapers.add(paper);
    await db.examSheets.bulkAdd(sheets);
  });
  return { paperId, sheetIds: sheets.map((sheet) => sheet.id) };
}

export async function saveSheetDraft(id: string, draft: SheetDraft) {
  const db = getDb();
  const sheet = await db.examSheets.get(id);
  if (!sheet) return;
  await db.examSheets.put({
    ...sheet,
    text: draft.text,
    flaggedWords: draft.flaggedWords,
    flagsFixed: draft.flagsFixed,
  });
}

/** Mark the reading checked. This does not index the page for search. */
export async function markSheetReviewed(id: string, draft: SheetDraft) {
  const db = getDb();
  const sheet = await db.examSheets.get(id);
  if (!sheet) return;
  await db.examSheets.put({
    ...sheet,
    text: draft.text,
    flaggedWords: draft.flaggedWords,
    flagsFixed: draft.flagsFixed,
    status: "digitized",
    ocrStatus: "ready",
  });
  await refreshPaperStatus(sheet.paperId);
}

export async function refreshPaperStatus(paperId: string) {
  const db = getDb();
  const sheets = await db.examSheets.where("paperId").equals(paperId).toArray();
  const reading = sheets.some((sheet) => sheet.ocrStatus === "queued" || sheet.ocrStatus === "reading");
  const ready = sheets.length > 0 && sheets.every((sheet) => sheet.status === "digitized");
  const status = reading ? "reading" : ready ? "ready" : "needs-review";
  await db.examPapers.update(paperId, { status });
}

export async function setPaperBackup(paperId: string, includeInDrive: boolean) {
  const db = getDb();
  await db.examPapers.update(paperId, { includeInDrive });
  const profiles = await db.examProfiles.where("paperId").equals(paperId).toArray();
  await Promise.all(profiles.map((profile) => db.examProfiles.update(profile.id, { includeInDrive })));
}

export async function replaceProfile(profile: ExamProfile) {
  const db = getDb();
  const previous = await db.examProfiles.where("paperId").equals(profile.paperId).toArray();
  await db.transaction("rw", db.examProfiles, async () => {
    if (previous.length > 0) await db.examProfiles.bulkDelete(previous.map((row) => row.id));
    await db.examProfiles.add(profile);
  });
}

export async function removePaper(paperId: string) {
  const db = getDb();
  const sheets = await db.examSheets.where("paperId").equals(paperId).toArray();
  const profiles = await db.examProfiles.where("paperId").equals(paperId).toArray();
  await db.transaction("rw", db.examPapers, db.examSheets, db.examProfiles, async () => {
    await db.examSheets.bulkDelete(sheets.map((sheet) => sheet.id));
    await db.examProfiles.bulkDelete(profiles.map((profile) => profile.id));
    await db.examPapers.delete(paperId);
  });
}

export function paperText(sheets: ExamSheet[]) {
  return sheets
    .slice()
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((sheet) => sheet.text.trim())
    .filter(Boolean)
    .join("\n\n");
}
