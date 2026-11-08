"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { getDb } from "@/lib/db";
import { isDemoId } from "@/lib/demo";

async function readingProgress() {
  const pages = (await getDb().notePages.toArray()).filter((page) => !isDemoId(page.id));
  const busy = pages.filter((page) => page.ocrStatus === "queued" || page.ocrStatus === "reading");
  if (busy.length === 0) return null;
  const newest = [...busy].sort((left, right) => right.createdAt - left.createdAt)[0];
  const group = newest?.ocrBatchId ? pages.filter((page) => page.ocrBatchId === newest.ocrBatchId) : busy;
  const total = group.length;
  const settled = group.filter((page) => page.ocrStatus === "ready" || page.ocrStatus === "error").length;
  const reading = group.filter((page) => page.ocrStatus === "reading").length;
  return { current: Math.min(total, Math.max(1, settled + reading)), total };
}

export function ReadingPill() {
  const pill = useLiveQuery(async () => {
    try {
      return await readingProgress();
    } catch {
      return null;
    }
  });

  if (!pill) return null;

  return (
    <div
      className="order-last flex w-full items-center gap-2 border-2 border-ink bg-paper px-2 py-1 text-ink sm:order-none sm:w-auto"
      role="status"
    >
      <PixelLoader size={12} tone="on-paper" />
      <span className="nw-mono text-[12px]">
        Reading {pill.current} of {pill.total}
      </span>
    </div>
  );
}
