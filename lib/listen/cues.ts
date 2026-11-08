import type { NotePage, Topic } from "@/lib/db";
import { splitSentences } from "@/lib/listen/sentences";

export type ListenCue = {
  pageId: string;
  start: number;
  end: number;
  text: string;
  label: string;
};

/** Reviewed pages only, in topic order, then page order. Blank pages add no cues. */
export function buildCues(pages: NotePage[], topics: Topic[], subjectName: string): ListenCue[] {
  const ready = pages.filter((page) => page.status === "digitized");
  const topicOrder = [...topics].sort((left, right) => left.createdAt - right.createdAt);
  const ordered = topicOrder.flatMap((topic) =>
    ready.filter((page) => page.topicId === topic.id).sort((left, right) => left.createdAt - right.createdAt),
  );
  const rest = ready
    .filter((page) => !ordered.some((item) => item.id === page.id))
    .sort((left, right) => left.createdAt - right.createdAt);

  const cues: ListenCue[] = [];
  for (const page of [...ordered, ...rest]) {
    const topic = topics.find((item) => item.id === page.topicId);
    const label = topic ? `${subjectName} · ${topic.name}` : subjectName;
    for (const slice of splitSentences(page.text)) {
      cues.push({ pageId: page.id, start: slice.start, end: slice.end, text: slice.text, label });
    }
  }
  return cues;
}
