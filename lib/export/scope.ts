import type { NotePage, Subject, Topic } from "@/lib/db";

export type ExportPage = {
  text: string;
  imageBlob?: Blob;
};

export type ExportSection = {
  topic: string;
  pages: ExportPage[];
};

export function reviewedPages(pages: NotePage[]) {
  return pages.filter((page) => page.status === "digitized");
}

export function pendingPages(pages: NotePage[]) {
  return pages.filter((page) => page.status !== "digitized");
}

/** Reviewed pages grouped by topic, in the order the topics were created. */
export function exportSections(pages: NotePage[], topics: Topic[], onlyTopic?: Topic): ExportSection[] {
  const ready = reviewedPages(pages).slice().sort((left, right) => left.createdAt - right.createdAt);
  const topicOrder = topics.slice().sort((left, right) => left.createdAt - right.createdAt);
  const groups = new Map<string, ExportSection>();

  for (const page of ready) {
    if (onlyTopic && page.topicId !== onlyTopic.id) continue;
    const topic = onlyTopic ?? topicOrder.find((item) => item.id === page.topicId);
    const name = topic?.name || "Notes";
    const key = topic?.id ?? name;
    const section = groups.get(key) ?? { topic: name, pages: [] };
    section.pages.push({ text: page.text, imageBlob: page.imageBlob });
    groups.set(key, section);
  }

  return [...groups.values()];
}

export function exportTitle(subject: Subject, topic?: Topic) {
  return { subject: subject.name, topic: topic?.name };
}
