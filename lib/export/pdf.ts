import type { ExportSection } from "@/lib/export/scope";
import { noteBlocks } from "@/lib/export/blocks";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const FOOTER = 42;

let fontPromise: Promise<ArrayBuffer> | null = null;

function loadFont() {
  if (!fontPromise) {
    fontPromise = fetch("/fonts/NotoSans-Regular.ttf").then(async (response) => {
      if (!response.ok) throw new Error("The export font could not be loaded.");
      return response.arrayBuffer();
    });
    fontPromise.catch(() => {
      fontPromise = null;
    });
  }
  return fontPromise;
}

function wrapLine(text: string, widthOf: (value: string) => number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (widthOf(next) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (widthOf(word) <= maxWidth) {
      line = word;
      continue;
    }
    let piece = "";
    for (const char of word) {
      const trial = piece + char;
      if (widthOf(trial) > maxWidth && piece) {
        lines.push(piece);
        piece = char;
      } else {
        piece = trial;
      }
    }
    line = piece;
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

async function embeddedImage(pdf: import("pdf-lib").PDFDocument, blob: Blob | undefined) {
  if (!blob || blob.size < 32) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes);
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
  return null;
}

export async function buildPdf(input: {
  subject: string;
  topic?: string;
  studentName: string;
  dateLabel: string;
  sections: ExportSection[];
  includePhotos: boolean;
}) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkitModule = await import("@pdf-lib/fontkit");
  const fontkit = fontkitModule.default ?? fontkitModule;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Subsetting keeps the download small and still includes ₦, accents, and superscripts that were drawn.
  const font = await pdf.embedFont(await loadFont(), { subset: true });
  const ink = rgb(0.09, 0.09, 0.09);
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  // pdf-lib measures y upward from the bottom of the page.
  let cursor = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursor = PAGE_HEIGHT - MARGIN;
  }

  function drawLines(text: string, size: number, indent: number, gap: number) {
    const maxWidth = contentWidth - indent;
    const safe = [...text].map((char) => {
      try {
        font.widthOfTextAtSize(char, size);
        return char;
      } catch {
        // A space leaves a gap you can see. Deleting the letter would hide the loss.
        return " ";
      }
    }).join("");
    const lines = wrapLine(safe, (value) => font.widthOfTextAtSize(value, size), maxWidth);
    for (const line of lines) {
      const step = size * 1.35;
      if (cursor - step < FOOTER) newPage();
      page.drawText(line, { x: MARGIN + indent, y: cursor - size, size, font, color: ink });
      cursor -= step;
    }
    cursor -= gap;
  }

  drawLines(input.subject, 28, 0, 10);
  drawLines(input.topic ?? input.sections.map((section) => section.topic).join(", "), 16, 0, 16);
  drawLines(input.dateLabel, 12, 0, 4);
  drawLines(input.studentName || "Student", 12, 0, 0);

  newPage();
  for (const section of input.sections) {
    drawLines(input.subject, 18, 0, 4);
    drawLines(section.topic, 14, 0, 10);
    section.pages.forEach((note, index) => {
      if (section.pages.length > 1) drawLines(`Page ${index + 1}`, 11, 0, 6);
      let item = 0;
      for (const block of noteBlocks(note.text)) {
        if (block.kind === "number") {
          item += 1;
          drawLines(`${item}.  ${block.text}`, 12, 12, 4);
          continue;
        }
        item = 0;
        if (block.kind === "bullet") drawLines(`•  ${block.text}`, 12, 12, 4);
        else drawLines(block.text, 12, 0, 8);
      }
      cursor -= 8;
    });
  }

  if (input.includePhotos) {
    for (const section of input.sections) {
      for (const [index, note] of section.pages.entries()) {
        const image = await embeddedImage(pdf, note.imageBlob);
        if (!image) continue;
        newPage();
        drawLines(`Original page · ${section.topic}${section.pages.length > 1 ? ` · ${index + 1}` : ""}`, 12, 0, 8);
        const maxWidth = contentWidth;
        const maxHeight = cursor - FOOTER;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: MARGIN,
          y: cursor - height,
          width,
          height,
        });
      }
    }
  }

  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    const label = String(index + 1);
    const width = font.widthOfTextAtSize(label, 10);
    sheet.drawText(label, { x: (PAGE_WIDTH - width) / 2, y: 24, size: 10, font, color: ink });
  });

  return pdf.save();
}
