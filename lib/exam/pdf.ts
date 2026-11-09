"use client";

import { EXAM_PAGE_CAP } from "@/lib/exam/bodies";
import type { ExamSheetSource } from "@/lib/db";

export type PdfPage = {
  pageNumber: number;
  source: Extract<ExamSheetSource, "pdf-text" | "pdf-ocr">;
  text: string;
  imageBlob: Blob;
};

type TextItem = { str?: string; hasEOL?: boolean };

let workerReady = false;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady) {
    // The worker file is the same build as this package, served by the app so the versions match.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  return pdfjs;
}

function pageText(items: TextItem[]) {
  let out = "";
  for (const item of items) {
    out += item.str ?? "";
    out += item.hasEOL ? "\n" : " ";
  }
  return out.replace(/[ ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** A header or a page number is not enough. Real question text has many letters. */
function hasUsefulText(text: string) {
  const letters = text.match(/[\p{L}\p{N}]/gu) ?? [];
  return letters.length >= 80;
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error("A PDF page could not be turned into a photo."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.82,
    );
  });
}

/**
 * Read a PDF in the browser. A page with selectable text is copied.
 * A scanned page is drawn to a JPEG so the handwriting reader can take it.
 * Returns at most EXAM_PAGE_CAP pages, and whether later pages were left out.
 */
export async function pagesFromPdf(file: File, onPage: (page: number, total: number) => void) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, disableRange: true });
  let doc: Awaited<typeof task.promise> | null = null;
  try {
    try {
      doc = await task.promise;
    } catch (caught) {
      const name = caught && typeof caught === "object" && "name" in caught ? String(caught.name) : "";
      if (name === "PasswordException") {
        throw new Error("This PDF is locked. Remove the password, or photograph the pages.");
      }
      throw new Error("That file could not be read as a PDF.");
    }

    const pages: PdfPage[] = [];
    const total = doc.numPages;
    if (total < 1) throw new Error("This PDF has no pages.");
    const used = Math.min(total, EXAM_PAGE_CAP);
    for (let number = 1; number <= used; number += 1) {
      onPage(number, used);
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const text = pageText(content.items as TextItem[]);
      if (hasUsefulText(text)) {
        pages.push({ pageNumber: number, source: "pdf-text", text, imageBlob: new Blob() });
        page.cleanup();
      } else {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1280 / Math.max(base.width, base.height, 1));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser could not draw a PDF page.");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const imageBlob = await canvasBlob(canvas);
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        pages.push({ pageNumber: number, source: "pdf-ocr", text: "", imageBlob });
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    return { pages, truncated: total > used };
  } finally {
    await doc?.cleanup().catch(() => undefined);
    await task.destroy().catch(() => undefined);
  }
}
