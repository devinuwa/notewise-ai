import { getDb } from "@/lib/db";

function replacer(_key: string, value: unknown) {
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return { kind: "blob", size: value.size, type: value.type };
  }
  if (value instanceof Float32Array) {
    return Array.from(value);
  }
  return value;
}

export async function exportAllData() {
  const db = getDb();
  // Past papers stay on the device unless the student ticked the backup box on that paper.
  const examPapers = (await db.examPapers.toArray()).filter((paper) => paper.includeInDrive);
  const sharedIds = new Set(examPapers.map((paper) => paper.id));
  const examSheets = (await db.examSheets.toArray()).filter((sheet) => sharedIds.has(sheet.paperId));
  const examProfiles = (await db.examProfiles.toArray()).filter(
    (profile) => profile.includeInDrive && sharedIds.has(profile.paperId),
  );
  const payload = {
    app: "NoteWise",
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    subjects: await db.subjects.toArray(),
    topics: await db.topics.toArray(),
    notePages: await db.notePages.toArray(),
    ...(examPapers.length > 0 ? { examPapers, examSheets, examProfiles } : {}),
  };
  const blob = new Blob([JSON.stringify(payload, replacer, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "notewise-backup.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
