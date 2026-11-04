import { getDb, type NotePage, type PageStatus, type Subject, type Topic } from "@/lib/db";

const DAY = 86_400_000;

function demoPage(
  id: string,
  topicId: string,
  subjectId: string,
  status: PageStatus,
  createdAt: number,
  text: string,
  extra?: { correctedAt?: number; flaggedWords?: string[]; raw?: string },
): NotePage {
  const raw = extra?.raw ?? text;
  return {
    id,
    topicId,
    subjectId,
    imageBlob: new Blob([], { type: "image/jpeg" }),
    rawOcrText: raw,
    text,
    flaggedWords: (extra?.flaggedWords ?? []).map((word) => ({
      text: word,
      index: Math.max(0, raw.toLowerCase().indexOf(word.toLowerCase())),
    })),
    ocrProvider: "cloud",
    status,
    createdAt,
    correctedAt: extra?.correctedAt,
  };
}

/** Replace previous DEMO rows and store a sample exam date so the countdown can be designed. */
export async function loadDemoNotes() {
  const db = getDb();
  const now = Date.now();
  const subjects: Subject[] = [
    { id: "demo-biology", name: "Biology", color: "#3D5F58", createdAt: now - 5 * DAY },
    { id: "demo-chemistry", name: "Chemistry", color: "#F5B726", createdAt: now - 4 * DAY },
    { id: "demo-mathematics", name: "Mathematics", color: "#8BB2DE", createdAt: now - 3 * DAY },
    { id: "demo-english", name: "English", color: "#E97B77", createdAt: now - 2 * DAY },
    { id: "demo-government", name: "Government", color: "#E4E3D8", createdAt: now - DAY },
  ];
  const topics: Topic[] = [
    { id: "demo-topic-cells", subjectId: "demo-biology", name: "Cell division", createdAt: now - 5 * DAY },
    { id: "demo-topic-osmosis", subjectId: "demo-biology", name: "Osmosis", createdAt: now - 4 * DAY },
    { id: "demo-topic-acids", subjectId: "demo-chemistry", name: "Acids and bases", createdAt: now - 4 * DAY },
    { id: "demo-topic-algebra", subjectId: "demo-mathematics", name: "Algebra", createdAt: now - 3 * DAY },
    { id: "demo-topic-comprehension", subjectId: "demo-english", name: "Comprehension", createdAt: now - 2 * DAY },
    { id: "demo-topic-constitution", subjectId: "demo-government", name: "The constitution", createdAt: now - DAY },
  ];
  const pages: NotePage[] = [
    demoPage(
      "demo-page-cells-1",
      "demo-topic-cells",
      "demo-biology",
      "digitized",
      now - 5 * DAY,
      "Mitosis splits one cell into two daughter cells with the same chromosomes.",
      { correctedAt: now - 2 * DAY },
    ),
    demoPage(
      "demo-page-cells-2",
      "demo-topic-cells",
      "demo-biology",
      "needs-review",
      now - 3 * DAY,
      "Chromosomes line up in the middle of the cell before they separate.",
      { raw: "Chromosones line up in the middle of the cell before they seperate.", flaggedWords: ["chromosones", "seperate"] },
    ),
    demoPage(
      "demo-page-osmosis",
      "demo-topic-osmosis",
      "demo-biology",
      "digitized",
      now - 2 * DAY,
      "Osmosis is water moving across a membrane from a weaker solution to a stronger one.",
    ),
    demoPage(
      "demo-page-acids-1",
      "demo-topic-acids",
      "demo-chemistry",
      "digitized",
      now - 4 * DAY,
      "An acid turns blue litmus red and has a pH below 7.",
    ),
    demoPage(
      "demo-page-acids-2",
      "demo-topic-acids",
      "demo-chemistry",
      "needs-review",
      now - DAY,
      "A base feels soapy and turns red litmus blue.",
      { raw: "A alkali feels soapy and turns red litmus blue.", flaggedWords: ["alkali"] },
    ),
    demoPage(
      "demo-page-english",
      "demo-topic-comprehension",
      "demo-english",
      "digitized",
      now - 2 * DAY,
      "Read the passage once, then answer with a line you can point to.",
    ),
    demoPage(
      "demo-page-gov",
      "demo-topic-constitution",
      "demo-government",
      "needs-review",
      now - DAY,
      "The legislature makes law, the executive carries it out, and the courts interpret it.",
      { raw: "The legistlature makes law.", flaggedWords: ["legistlature"] },
    ),
  ];

  await db.transaction("rw", [db.subjects, db.topics, db.notePages, db.settings], async () => {
    const [existingSubjects, existingTopics, existingPages, settings] = await Promise.all([
      db.subjects.toArray(),
      db.topics.toArray(),
      db.notePages.toArray(),
      db.settings.get("local"),
    ]);
    await db.subjects.bulkDelete(existingSubjects.filter((row) => row.id.startsWith("demo-")).map((row) => row.id));
    await db.topics.bulkDelete(existingTopics.filter((row) => row.id.startsWith("demo-")).map((row) => row.id));
    await db.notePages.bulkDelete(existingPages.filter((row) => row.id.startsWith("demo-")).map((row) => row.id));
    await db.subjects.bulkPut(subjects);
    await db.topics.bulkPut(topics);
    await db.notePages.bulkPut(pages);
    if (settings?.name) {
      await db.settings.put({ ...settings, examDate: now + 63 * DAY });
    }
  });
}
