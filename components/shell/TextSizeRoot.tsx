"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, type ReactNode } from "react";
import { getDb } from "@/lib/db";
import { isTextSize, TEXT_SIZE_CSS, type TextSize } from "@/lib/text-size";

function applySize(size: TextSize) {
  document.documentElement.dataset.textSize = size;
  document.documentElement.style.fontSize = TEXT_SIZE_CSS[size];
}

/** Applies the saved text-size preference to <html>. */
export function TextSizeRoot({ children }: { children: ReactNode }) {
  const size = useLiveQuery(async () => {
    const settings = await getDb().settings.get("local");
    return isTextSize(settings?.textSize) ? settings.textSize : "md";
  }, []) ?? "md";

  useEffect(() => {
    applySize(size);
  }, [size]);

  return children;
}
