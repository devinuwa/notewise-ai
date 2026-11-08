import { getDb } from "@/lib/db";
import type { NotePage, Subject, Topic } from "@/lib/db";

export function searchPages(pages: NotePage[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return pages.filter((page) => page.text.toLowerCase().includes(needle));
}

export function snippet(text: string, query: string) {
  const needle = query.trim().toLowerCase();
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0) return text.slice(0, 90);
  const from = Math.max(0, at - 36);
  const to = Math.min(text.length, at + needle.length + 48);
  const piece = text.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${piece}${to < text.length ? "…" : ""}`;
}

export async function renameSubject(id: string, name: string) {
  const db = getDb();
  const subject = await db.subjects.get(id);
  const next = name.trim();
  if (!subject || !next) return;
  await db.subjects.put({ ...subject, name: next });
}

export async function renameTopic(id: string, name: string) {
  const db = getDb();
  const topic = await db.topics.get(id);
  const next = name.trim();
  if (!topic || !next) return;
  await db.topics.put({ ...topic, name: next });
}

export async function deleteTopic(id: string) {
  const db = getDb();
  await db.transaction("rw", [db.topics, db.notePages, db.chunks], async () => {
    await db.chunks.where("topicId").equals(id).delete();
    await db.notePages.where("topicId").equals(id).delete();
    await db.topics.delete(id);
  });
}

export async function deletePage(id: string) {
  const db = getDb();
  await db.transaction("rw", [db.notePages, db.chunks], async () => {
    await db.chunks.where("pageId").equals(id).delete();
    await db.notePages.delete(id);
  });
}

export function topicPages(pages: NotePage[], topicId: string) {
  return pages.filter((page) => page.topicId === topicId).sort((a, b) => b.createdAt - a.createdAt);
}

export function subjectTopics(topics: Topic[], subjectId: string) {
  return topics.filter((topic) => topic.subjectId === subjectId).sort((a, b) => a.name.localeCompare(b.name));
}

export function subjectById(subjects: Subject[], id: string) {
  return subjects.find((subject) => subject.id === id) ?? null;
}
