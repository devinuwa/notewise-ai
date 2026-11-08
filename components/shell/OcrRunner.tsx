"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { kickOcrQueue, recoverInterrupted } from "@/lib/ocr/queue";
import { preloadOnDevice } from "@/lib/ocr/tesseract";

export function OcrRunner() {
  const settings = useLiveQuery(async () => {
    try {
      return await getDb().settings.get("local");
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    let stop = false;
    void recoverInterrupted().then(() => {
      if (!stop) kickOcrQueue();
    });
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    kickOcrQueue();
  }, [settings]);

  useEffect(() => {
    if (settings?.ocrMode !== "on-device") return;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => void preloadOnDevice(), { timeout: 2000 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => void preloadOnDevice(), 1500);
    return () => window.clearTimeout(timer);
  }, [settings?.ocrMode]);

  return null;
}
