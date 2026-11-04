import type { NotePage, Subject, Topic } from "@/lib/db";

export function isDemoId(id: string) {
  return id.startsWith("demo-");
}

/** Sample rows are for design. They never count toward Home or the proposal stats. */
export function withoutDemoPages(pages: NotePage[]) {
  return pages.filter((page) => !isDemoId(page.id));
}

export function withoutDemoSubjects(subjects: Subject[]) {
  return subjects.filter((subject) => !isDemoId(subject.id));
}

export const showDemoNotes = process.env.NODE_ENV !== "production";

export function shownPages(pages: NotePage[]) {
  return showDemoNotes ? pages : withoutDemoPages(pages);
}

export function shownSubjects(subjects: Subject[]) {
  return showDemoNotes ? subjects : withoutDemoSubjects(subjects);
}

export function shownTopics(topics: Topic[]) {
  return showDemoNotes ? topics : topics.filter((topic) => !isDemoId(topic.id));
}
