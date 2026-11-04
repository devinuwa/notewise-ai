import type { NotePage } from "@/lib/db";
import { withoutDemoPages } from "@/lib/demo";

export function wordsOf(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
}

/** Word-level Levenshtein. One insert, delete, or swap of a whole word costs 1. */
export function wordEditDistance(left: string[], right: string[]) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
    }
    previous = current;
  }
  return previous[right.length];
}

/** 1 minus the word edits, divided by the final word count. Empty final text has no score. */
export function wordAccuracy(raw: string, finalText: string) {
  const finalWords = wordsOf(finalText);
  if (finalWords.length === 0) return null;
  const distance = wordEditDistance(wordsOf(raw), finalWords);
  return Math.max(0, 1 - distance / finalWords.length);
}

export type ProviderAccuracy = {
  pages: number;
  average: number | null;
};

export type AccuracyStats = {
  digitized: number;
  flagsFixed: number;
  cloud: ProviderAccuracy;
  device: ProviderAccuracy;
};

function providerOf(value: string): "cloud" | "device" | null {
  if (value === "gemini" || value === "cloud") return "cloud";
  if (value === "tesseract" || value === "on-device") return "device";
  return null;
}

function averageOf(scores: number[]): ProviderAccuracy {
  if (scores.length === 0) return { pages: 0, average: null };
  const total = scores.reduce((sum, score) => sum + score, 0);
  return { pages: scores.length, average: total / scores.length };
}

export function accuracyStats(pages: NotePage[]): AccuracyStats {
  const real = withoutDemoPages(pages);
  const done = real.filter((page) => page.status === "digitized");
  const cloud: number[] = [];
  const device: number[] = [];
  for (const page of done) {
    const score = wordAccuracy(page.rawOcrText, page.text);
    if (score === null) continue;
    const provider = providerOf(page.ocrProvider);
    if (provider === "cloud") cloud.push(score);
    if (provider === "device") device.push(score);
  }
  return {
    digitized: done.length,
    flagsFixed: real.reduce((sum, page) => sum + (page.flagsFixed ?? 0), 0),
    cloud: averageOf(cloud),
    device: averageOf(device),
  };
}

function percent(group: ProviderAccuracy, label: string) {
  if (group.average === null) return `${label}: no corrected pages yet`;
  const pages = group.pages === 1 ? "1 page" : `${group.pages} pages`;
  return `${label}: ${Math.round(group.average * 100)}% (${pages})`;
}

export function statsParagraph(stats: AccuracyStats) {
  return [
    `Pages digitized: ${stats.digitized}`,
    `Flagged words fixed: ${stats.flagsFixed}`,
    percent(stats.cloud, "Cloud OCR accuracy before correction"),
    percent(stats.device, "On-device OCR accuracy before correction"),
  ].join("\n");
}
