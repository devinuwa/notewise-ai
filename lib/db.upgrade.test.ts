/**
 * Opens a v7 NoteWise database with old-schema data, then upgrades via NoteWiseDB.
 * Run: npm test
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import Dexie from "dexie";
import { NoteWiseDB } from "@/lib/db";

after(async () => {
  await Dexie.delete("notewise");
});

test("Dexie v8 upgrade keeps subjects and adds tutorLanguage without wiping data", async () => {
  await Dexie.delete("notewise");

  // Simulate a phone still on schema 7 (before tutor language).
  const legacy = new Dexie("notewise");
  legacy.version(7).stores({
    subjects: "id, name, createdAt",
    topics: "id, subjectId, createdAt",
    notePages: "id, topicId, subjectId, status, createdAt",
    settings: "id",
    ocrCache: "hash",
    chunks: "id, pageId, topicId, subjectId, createdAt",
    chatMessages: "id, role, createdAt",
    quizzes: "id, subjectId, topicId, createdAt",
    attempts: "id, quizId, takenAt",
    examPapers: "id, examBody, subjectName, year, createdAt",
    examSheets: "id, paperId, pageNumber, status",
    examProfiles: "id, paperId, examBody, subjectName, createdAt",
  });
  await legacy.open();
  await legacy.table("settings").put({
    id: "local",
    name: "Amina Musa",
    aiConsent: true,
    ocrMode: "cloud",
  });
  await legacy.table("subjects").put({
    id: "sub-physics",
    name: "Physics",
    color: "#e53927",
    createdAt: 1,
  });
  await legacy.table("notePages").put({
    id: "page-1",
    topicId: "topic-1",
    subjectId: "sub-physics",
    imageBlob: new Blob(["x"]),
    rawOcrText: "waves",
    text: "waves",
    flaggedWords: [],
    ocrProvider: "cloud",
    status: "digitized",
    createdAt: 2,
  });
  legacy.close();

  const next = new NoteWiseDB();
  await next.open();

  const settings = await next.settings.get("local");
  assert.equal(settings?.name, "Amina Musa");
  assert.equal(settings?.tutorLanguage, "en");
  assert.equal(await next.subjects.count(), 1);
  assert.equal(await next.notePages.count(), 1);
  assert.equal((await next.subjects.get("sub-physics"))?.name, "Physics");

  next.close();
});
