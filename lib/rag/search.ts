import { getBrain } from "@/lib/rag/brain";
import { rankByKeywords } from "@/lib/rag/bm25";
import { cosine } from "@/lib/rag/cosine";
import { shownPages } from "@/lib/demo";
import { getDb, type Chunk } from "@/lib/db";

export type SearchHit = {
  pageId: string;
  topicId: string;
  subjectId: string;
  text: string;
  score: number;
};

export type SearchOptions = {
  subjectId?: string;
  topicId?: string;
  k?: number;
};

type Doc = {
  pageId: string;
  topicId: string;
  subjectId: string;
  text: string;
};

function inScope(doc: { subjectId: string; topicId: string }, options: SearchOptions) {
  if (options.subjectId && doc.subjectId !== options.subjectId) return false;
  if (options.topicId && doc.topicId !== options.topicId) return false;
  return true;
}

function asVector(value: ArrayLike<number> | Float32Array) {
  return value instanceof Float32Array ? value : Float32Array.from(value ?? []);
}

/**
 * Meaning search when the model is ready. Keyword ranking otherwise,
 * so a search still answers while the model is downloading.
 */
export async function search(query: string, options: SearchOptions = {}): Promise<{ hits: SearchHit[]; mode: "semantic" | "keyword" }> {
  const needle = query.trim();
  const k = options.k ?? 8;
  if (!needle || k <= 0) return { hits: [], mode: "keyword" };

  const db = getDb();
  const [pages, chunks] = await Promise.all([db.notePages.toArray(), db.chunks.toArray()]);
  const reviewed = shownPages(pages).filter(
    (page) => page.status === "digitized" && page.text.trim() && inScope(page, options),
  );
  const allowed = new Set(reviewed.map((page) => page.id));
  const scoped = chunks.filter((chunk) => allowed.has(chunk.pageId));
  const embedded = scoped.filter((chunk) => asVector(chunk.embedding).length > 0);

  if (getBrain().phase === "ready" && embedded.length > 0) {
    try {
      const { embedTexts } = await import("@/lib/rag/embed-client");
      const [vector] = await embedTexts([needle]);
      if (vector && vector.length > 0) {
        const ranked = embedded
          .map((chunk) => ({ chunk, score: cosine(vector, asVector(chunk.embedding)) }))
          // 0.3 drops a note that only shares a vague topic. A paraphrase of the note still passes.
          .filter((row) => row.score >= 0.3)
          .sort((a, b) => b.score - a.score)
          .slice(0, k)
          .map(({ chunk, score }) => toHit(chunk, score));

        const covered = new Set(embedded.map((chunk) => chunk.pageId));
        const missing = reviewed.filter((page) => !covered.has(page.id));
        if (missing.length > 0 && ranked.length < k) {
          const extra = rankByKeywords(needle, missing, k - ranked.length).filter(
            (hit) => !ranked.some((row) => row.pageId === hit.pageId),
          );
          return { hits: [...ranked, ...extra].slice(0, k), mode: "semantic" };
        }
        return { hits: ranked, mode: "semantic" };
      }
    } catch {
      // The model answered badly. Words still work.
    }
  } else {
    const { kickEmbedder } = await import("@/lib/rag/embed-client");
    kickEmbedder();
  }

  return { hits: rankByKeywords(needle, keywordDocs(reviewed, scoped), k), mode: "keyword" };
}

function toHit(chunk: Chunk, score: number): SearchHit {
  return {
    pageId: chunk.pageId,
    topicId: chunk.topicId,
    subjectId: chunk.subjectId,
    text: chunk.text,
    score,
  };
}

function keywordDocs(pages: { id: string; topicId: string; subjectId: string; text: string }[], chunks: Chunk[]): Doc[] {
  const byPage = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = byPage.get(chunk.pageId) ?? [];
    list.push(chunk);
    byPage.set(chunk.pageId, list);
  }
  const docs: Doc[] = [];
  for (const page of pages) {
    const rows = byPage.get(page.id);
    if (rows && rows.length > 0) {
      for (const row of rows) docs.push(row);
    } else {
      docs.push({ pageId: page.id, topicId: page.topicId, subjectId: page.subjectId, text: page.text });
    }
  }
  return docs;
}
