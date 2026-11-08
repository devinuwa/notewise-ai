import { bumpIndex, getBrain } from "@/lib/rag/brain";
import { chunkText } from "@/lib/rag/chunk";
import { getDb, type Chunk, type NotePage } from "@/lib/db";

const waits = new Map<string, number>();

function chunkNumber(id: string) {
  const value = Number(id.slice(id.lastIndexOf(":") + 1));
  return Number.isFinite(value) ? value : 0;
}

function sameIndex(page: NotePage, pieces: string[], existing: Chunk[]) {
  if (existing.length !== pieces.length) return false;
  const ordered = [...existing].sort((a, b) => chunkNumber(a.id) - chunkNumber(b.id));
  return ordered.every(
    (row, index) =>
      row.text === pieces[index] &&
      row.embedding.length > 0 &&
      row.topicId === page.topicId &&
      row.subjectId === page.subjectId,
  );
}

export async function deleteChunks(pageId: string) {
  const db = getDb();
  await db.chunks.where("pageId").equals(pageId).delete();
}

async function embedPieces(pieces: string[]) {
  const { embedTexts, isEmbedderReady, kickEmbedder } = await import("@/lib/rag/embed-client");
  if (!isEmbedderReady()) {
    kickEmbedder();
    return null;
  }
  return embedTexts(pieces);
}

const pageChains = new Map<string, Promise<boolean>>();

/** Rebuild stored chunks when the reviewed text changed. Skips the model when nothing changed. */
export function indexPage(page: NotePage) {
  const previous = pageChains.get(page.id) ?? Promise.resolve(false);
  const run = previous.then(
    () => indexPageNow(page),
    () => indexPageNow(page),
  );
  pageChains.set(page.id, run);
  return run;
}

async function indexPageNow(page: NotePage) {
  const db = getDb();
  if (page.status !== "digitized" || !page.text.trim()) {
    await deleteChunks(page.id);
    return false;
  }

  const pieces = chunkText(page.text);
  const existing = await db.chunks.where("pageId").equals(page.id).toArray();
  if (pieces.length === 0) {
    if (existing.length > 0) await deleteChunks(page.id);
    return existing.length > 0;
  }
  if (sameIndex(page, pieces, existing)) return false;

  const vectors = await embedPieces(pieces).catch(() => null);
  if (!vectors || vectors.length !== pieces.length) return false;

  const latest = await db.notePages.get(page.id);
  if (!latest || latest.status !== "digitized" || latest.text !== page.text) return false;

  const createdAt = Date.now();
  const rows: Chunk[] = pieces.map((text, index) => ({
    id: `${page.id}:${index}`,
    pageId: page.id,
    topicId: latest.topicId,
    subjectId: latest.subjectId,
    text,
    embedding: vectors[index] ?? new Float32Array(),
    createdAt,
  }));

  await db.transaction("rw", db.chunks, async () => {
    await db.chunks.where("pageId").equals(page.id).delete();
    await db.chunks.bulkAdd(rows);
  });
  return true;
}

export async function indexStoredPage(pageId: string) {
  const page = await getDb().notePages.get(pageId);
  if (!page) {
    await deleteChunks(pageId);
    bumpIndex();
    return;
  }
  const changed = await indexPage(page);
  if (changed) bumpIndex();
}

/** Wait so a burst of edits embeds once, from the text that was actually saved. */
export function scheduleIndex(pageId: string) {
  if (typeof window === "undefined") return;
  const previous = waits.get(pageId);
  if (previous) window.clearTimeout(previous);
  waits.set(
    pageId,
    window.setTimeout(() => {
      waits.delete(pageId);
      void indexStoredPage(pageId);
    }, 800),
  );
}

let lastKey = "";

function signature(pages: NotePage[]) {
  return pages
    .filter((page) => page.status === "digitized")
    .map((page) => `${page.id}:${page.topicId}:${page.subjectId}:${page.text}:${page.correctedAt ?? 0}`)
    .join("\n");
}

/** Index reviewed pages that are new or edited, and drop chunks for pages that are gone. */
export async function syncReviewed(pages: NotePage[]) {
  const key = `${getBrain().phase}:${signature(pages)}`;
  if (key === lastKey) return;
  const reviewed = pages.filter((page) => page.status === "digitized" && page.text.trim());
  const ids = new Set(reviewed.map((page) => page.id));
  const db = getDb();
  const stored = await db.chunks.toArray();
  const orphans = [...new Set(stored.map((row) => row.pageId))].filter((id) => !ids.has(id));
  await Promise.all(orphans.map((id) => deleteChunks(id)));

  const { isEmbedderReady, kickEmbedder } = await import("@/lib/rag/embed-client");
  if (!isEmbedderReady()) {
    kickEmbedder();
    lastKey = `${getBrain().phase}:${signature(pages)}`;
    return;
  }

  let changed = orphans.length > 0;
  for (const page of reviewed) {
    if (await indexPage(page)) changed = true;
  }
  lastKey = `${getBrain().phase}:${signature(pages)}`;
  if (changed) bumpIndex();
}
