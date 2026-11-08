import { getDb, type NotePage, type OcrMode, type Settings, type Subject, type Topic } from "@/lib/db";
import { isDemoId } from "@/lib/demo";
import type { SpeechRate } from "@/lib/listen/rates";
import { titleCaseName } from "@/lib/name";
import type { NoteStatus } from "@/lib/status";

export interface NotebookSnapshot {
  settings: Settings | null;
  subjects: Subject[];
  topics: Topic[];
  pages: NotePage[];
}

export interface NoteCard {
  id: string;
  subject: string;
  title: string;
  color: string;
  pageCount: number;
  updatedAt: number;
  status: NoteStatus;
  demo: boolean;
}

export interface ActivityProgress {
  id: string;
  label: string;
  progress: number;
  goal: number;
}

export async function readNotebook(): Promise<NotebookSnapshot> {
  const db = getDb();
  const [settings, subjects, topics, pages] = await Promise.all([
    db.settings.get("local"),
    db.subjects.toArray(),
    db.topics.toArray(),
    db.notePages.toArray(),
  ]);
  return { settings: settings ?? null, subjects, topics, pages };
}

export async function saveStudentName(raw: string) {
  const db = getDb();
  const existing = await db.settings.get("local");
  const name = titleCaseName(raw);
  if (!name) {
    throw new Error("Name is empty.");
  }
  await db.settings.put({
    ...existing,
    id: "local",
    name,
    aiConsent: existing?.aiConsent ?? false,
    ocrMode: existing?.ocrMode ?? "cloud",
  });
}

export async function saveReadingChoice(choice: { aiConsent: boolean; ocrMode: OcrMode }) {
  const db = getDb();
  const existing = await db.settings.get("local");
  await db.settings.put({
    ...existing,
    id: "local",
    name: existing?.name ?? "",
    aiConsent: choice.aiConsent,
    ocrMode: choice.ocrMode,
  });
}

export async function saveExamDate(examDate?: number) {
  const db = getDb();
  const existing = await db.settings.get("local");
  if (!existing?.name) {
    throw new Error("Save a name before an exam date.");
  }
  const next: Settings = { ...existing, id: "local" };
  if (examDate) next.examDate = examDate;
  else delete next.examDate;
  await db.settings.put(next);
}

export async function saveListenPrefs(prefs: { voiceURI?: string; speechRate?: SpeechRate }) {
  const db = getDb();
  const existing = await db.settings.get("local");
  if (!existing?.name) return;
  await db.settings.put({ ...existing, ...prefs, id: "local" });
}

/** A card is not started with no pages, needs review if any page does, backed up only when every page has a Drive id. */
export function statusForPages(pages: NotePage[]): NoteStatus {
  if (pages.length === 0) return "not-started";
  if (pages.some((page) => page.status === "needs-review")) return "needs-review";
  if (pages.every((page) => page.driveFileId)) return "backed-up";
  return "digitized";
}

export function noteCards(subjects: Subject[], topics: Topic[], pages: NotePage[]): NoteCard[] {
  return [...subjects]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((subject) => {
      const subjectTopics = topics.filter((topic) => topic.subjectId === subject.id);
      const subjectPages = pages.filter((page) => page.subjectId === subject.id);
      const updatedAt = subjectPages.reduce(
        (latest, page) => Math.max(latest, page.correctedAt ?? page.createdAt),
        subject.createdAt,
      );
      const title = subjectTopics.map((topic) => topic.name).join(" · ");
      return {
        id: subject.id,
        subject: subject.name,
        title: title || subject.name,
        color: subject.color,
        pageCount: subjectPages.length,
        updatedAt,
        status: statusForPages(subjectPages),
        demo: isDemoId(subject.id),
      };
    });
}

/** Quiz stays at zero until that screen writes records. Tutor counts saved questions. */
export function activityProgress(pages: NotePage[], tutorQuestions = 0): ActivityProgress[] {
  return [
    { id: "scan", label: "Scan 5 pages", progress: pages.length, goal: 5 },
    {
      id: "ocr",
      label: "Fix 3 OCR mistakes",
      progress: pages.filter((page) => page.correctedAt).length,
      goal: 3,
    },
    { id: "quiz", label: "Finish a 10-question quiz", progress: 0, goal: 10 },
    { id: "tutor", label: "Ask the Tutor 3 questions", progress: tutorQuestions, goal: 3 },
    {
      id: "drive",
      label: "Back up to Drive",
      progress: pages.some((page) => page.driveFileId) ? 1 : 0,
      goal: 1,
    },
  ];
}

export function examDateInputValue(examDate?: number) {
  if (!examDate) return "";
  const date = new Date(examDate);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function examDateFromInput(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day).getTime();
}
