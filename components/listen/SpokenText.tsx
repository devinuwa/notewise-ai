"use client";

import { useEffect, useRef } from "react";
import { useListen } from "@/components/listen/ListenProvider";

export function SpokenText({ pageId, text }: { pageId: string; text: string }) {
  const { cues, index } = useListen();
  const ref = useRef<HTMLParagraphElement>(null);
  const cue = cues[index];
  const active = Boolean(cue && cue.pageId === pageId && text.slice(cue.start, cue.end) === cue.text);
  const mark = active && cue ? cue : null;

  useEffect(() => {
    if (!mark) return;
    const node = ref.current?.querySelector("[data-speaking]");
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [mark]);

  if (!mark) {
    return <p className="whitespace-pre-wrap text-lg text-ink">{text || "This page has no text yet."}</p>;
  }

  return (
    <p ref={ref} className="whitespace-pre-wrap text-lg text-ink">
      {text.slice(0, mark.start)}
      <mark data-speaking className="bg-yellow px-0.5 text-ink">
        {text.slice(mark.start, mark.end)}
      </mark>
      {text.slice(mark.end)}
    </p>
  );
}
