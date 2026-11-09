import { getDb, type NotePage, type Topic } from "@/lib/db";
import { shownPages } from "@/lib/demo";
import { wordCount, type NoteChunk } from "@/lib/practice/check";

const CHUNK_LIMIT = 12;
const TEXT_LIMIT = 1500;

function pageLabel(pages: NotePage[], topics: Topic[], page: NotePage) {
  const topic = topics.find((item) => item.id === page.topicId)?.name ?? "Topic";
  const siblings = pages
    .filter((item) => item.topicId === page.topicId)
    .sort((left, right) => left.createdAt - right.createdAt);
  const index = siblings.findIndex((item) => item.id === page.id);
  return `${topic} > page ${index >= 0 ? index + 1 : 1}`;
}

/**
 * Reviewed pages only. Stored chunks are preferred. A page that is not indexed yet
 * still contributes its corrected text, so practice is not blocked by the download.
 */
export async function notesForQuiz(subjectId: string, topicId?: string) {
  const db = getDb();
  const [pages, chunks, topics] = await Promise.all([
    db.notePages.toArray(),
    db.chunks.toArray(),
    db.topics.toArray(),
  ]);
  const reviewed = shownPages(pages).filter(
    (page) =>
      page.status === "digitized" &&
      page.text.trim() &&
      page.subjectId === subjectId &&
      (!topicId || page.topicId === topicId),
  );
  const allowed = new Set(reviewed.map((page) => page.id));
  const stored = chunks.filter((chunk) => allowed.has(chunk.pageId) && chunk.text.trim());
  const covered = new Set(stored.map((chunk) => chunk.pageId));
  const rows: NoteChunk[] = [];
  for (const chunk of stored) {
    const page = reviewed.find((item) => item.id === chunk.pageId);
    if (!page) continue;
    rows.push({
      label: pageLabel(reviewed, topics, page),
      text: chunk.text.trim().slice(0, TEXT_LIMIT),
      pageId: page.id,
      topicId: page.topicId,
      subjectId: page.subjectId,
    });
  }
  for (const page of reviewed) {
    if (covered.has(page.id)) continue;
    rows.push({
      label: pageLabel(reviewed, topics, page),
      text: page.text.trim().slice(0, TEXT_LIMIT),
      pageId: page.id,
      topicId: page.topicId,
      subjectId: page.subjectId,
    });
  }
  const picked = [...rows]
    .sort((left, right) => right.text.length - left.text.length)
    .slice(0, CHUNK_LIMIT);
  const words = wordCount(picked.map((row) => row.text).join(" "));
  return { chunks: picked, words };
}
