/** pdfjs-dist mentions this Node package. Exam pages are drawn in the browser, so this is never called. */
export function createCanvas(): never {
  throw new Error("PDF pages are drawn in the browser.");
}
