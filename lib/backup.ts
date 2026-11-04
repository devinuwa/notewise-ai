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
  const payload = {
    app: "NoteWise",
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    subjects: await db.subjects.toArray(),
    topics: await db.topics.toArray(),
    notePages: await db.notePages.toArray(),
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
