import { getDb, type NotePage, type Settings } from "@/lib/db";
import { findAppFolder, listChildren, uploadMultipart } from "@/lib/drive/api";
import { ensureDriveToken } from "@/lib/drive/gis";
import { buildManifest } from "@/lib/drive/manifest";
import { DRIVE_FOLDER_NAME, DRIVE_MANIFEST_NAME } from "@/lib/drive/types";

export type BackupProgress = {
  caption: string;
  done: number;
  total: number;
};

async function saveDriveIds(patch: Partial<Settings>) {
  const db = getDb();
  const existing = await db.settings.get("local");
  if (!existing?.name) return;
  await db.settings.put({ ...existing, ...patch, id: "local" });
}

/**
 * Create or update the NoteWise folder + manifest.
 * Photos upload only when includePhotos is true. Pages get driveFileId so Home shows BACKED UP.
 */
export async function backupToDrive(includePhotos: boolean, onProgress?: (progress: BackupProgress) => void) {
  const token = await ensureDriveToken();
  const db = getDb();
  const settings = await db.settings.get("local");
  const pages = await db.notePages.toArray();
  const photoPages = includePhotos ? pages.filter((page) => page.imageBlob && page.imageBlob.size > 0) : [];
  const total = 2 + photoPages.length;
  let done = 0;
  const tick = (caption: string) => {
    done += 1;
    onProgress?.({ caption, done, total });
  };

  onProgress?.({ caption: "Opening your NoteWise folder…", done: 0, total });
  const folderId = await findAppFolder(token.accessToken, DRIVE_FOLDER_NAME, settings?.driveFolderId);
  await saveDriveIds({ driveFolderId: folderId });
  tick("Folder ready");

  const photoIds: Record<string, string> = {};
  for (const page of photoPages) {
    onProgress?.({
      caption: `Uploading photo ${Object.keys(photoIds).length + 1} of ${photoPages.length}…`,
      done,
      total,
    });
    const existingPhoto = page.driveFileId && !page.driveFileId.startsWith("manifest:") ? page.driveFileId : undefined;
    const jpeg =
      page.imageBlob.type === "image/jpeg"
        ? page.imageBlob
        : new Blob([await page.imageBlob.arrayBuffer()], { type: "image/jpeg" });
    const file = await uploadMultipart(token.accessToken, {
      name: `page-${page.id}.jpg`,
      mimeType: "image/jpeg",
      parents: [folderId],
      body: jpeg,
      fileId: existingPhoto,
    });
    photoIds[page.id] = file.id;
    await db.notePages.update(page.id, { driveFileId: file.id });
    tick(`Saved photo ${Object.keys(photoIds).length}`);
  }

  onProgress?.({ caption: "Saving the notebook JSON…", done, total });
  const manifest = await buildManifest(includePhotos, photoIds);
  const knownManifest = settings?.driveManifestId;
  let manifestId = knownManifest;
  if (manifestId) {
    try {
      const file = await uploadMultipart(token.accessToken, {
        name: DRIVE_MANIFEST_NAME,
        mimeType: "application/json",
        body: JSON.stringify(manifest, null, 2),
        fileId: manifestId,
      });
      manifestId = file.id;
    } catch {
      manifestId = undefined;
    }
  }
  if (!manifestId) {
    const existing = await listChildren(token.accessToken, folderId, DRIVE_MANIFEST_NAME);
    const file = await uploadMultipart(token.accessToken, {
      name: DRIVE_MANIFEST_NAME,
      mimeType: "application/json",
      parents: [folderId],
      body: JSON.stringify(manifest, null, 2),
      fileId: existing[0]?.id,
    });
    manifestId = file.id;
  }
  await saveDriveIds({ driveFolderId: folderId, driveManifestId: manifestId });

  // Text-only backups still mark pages so Home can show BACKED UP.
  const updates: NotePage[] = [];
  for (const page of pages) {
    const nextId = photoIds[page.id] ?? page.driveFileId ?? `manifest:${manifestId}`;
    if (page.driveFileId === nextId) continue;
    updates.push({ ...page, driveFileId: nextId });
  }
  if (updates.length > 0) await db.notePages.bulkPut(updates);
  tick("Backup saved");

  return { folderId, manifestId, photos: Object.keys(photoIds).length };
}
