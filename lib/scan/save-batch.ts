import { getDb, type NotePage, type Subject, type Topic } from "@/lib/db";
import { newId } from "@/lib/scan/ids";
import { canonicalSubjectName, nextSubjectColour } from "@/lib/scan/subjects";

export type BatchImage = {
  imageBlob: Blob;
  ocrBlob: Blob;
  preprocessMs: number;
};

function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export async function saveScanBatch(input: {
  images: BatchImage[];
  subjectName: string;
  topicName: string;
}) {
  const subjectName = canonicalSubjectName(input.subjectName);
  const topicName = input.topicName.trim().replace(/\s+/g, " ");
  if (!subjectName || !topicName) {
    throw new Error("Choose a subject and a topic before reading the handwriting.");
  }
  if (input.images.length === 0) {
    throw new Error("Add a page before reading the handwriting.");
  }

  const db = getDb();
  const now = Date.now();
  const batchId = newId();
  const pageIds: string[] = [];

  await db.transaction("rw", [db.subjects, db.topics, db.notePages], async () => {
    const subjects = await db.subjects.toArray();
    let subject = subjects.find((item) => sameName(item.name, subjectName));
    if (!subject) {
      subject = {
        id: newId(),
        name: subjectName,
        color: nextSubjectColour(subjects.length),
        createdAt: now,
      };
      await db.subjects.add(subject);
    }

    const topics = await db.topics.where("subjectId").equals(subject.id).toArray();
    let topic = topics.find((item) => sameName(item.name, topicName));
    if (!topic) {
      topic = {
        id: newId(),
        subjectId: subject.id,
        name: topicName,
        createdAt: now,
      };
      await db.topics.add(topic);
    }

    const records: NotePage[] = input.images.map((image, index) => {
      const id = newId();
      pageIds.push(id);
      return {
        id,
        topicId: topic.id,
        subjectId: subject.id,
        imageBlob: image.imageBlob,
        ocrBlob: image.ocrBlob,
        preprocessMs: image.preprocessMs,
        ocrStatus: "queued",
        ocrBatchId: batchId,
        rawOcrText: "",
        text: "",
        flaggedWords: [],
        ocrProvider: "",
        status: "needs-review",
        createdAt: now + index,
      };
    });
    await db.notePages.bulkAdd(records);
  });

  return { pageIds, batchId, subjectName, topicName };
}

export type { Subject, Topic };
