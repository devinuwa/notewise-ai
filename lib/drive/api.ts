import { DriveError } from "@/lib/drive/errors";
import type { DriveFile } from "@/lib/drive/types";

async function driveFetch(token: string, url: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new DriveError("You look offline. Connect to the internet and try again.");
  }

  if (response.ok) return response;

  const body = await response.text().catch(() => "");
  if (response.status === 401) {
    throw new DriveError("Google Drive access expired. Connect Google Drive again.");
  }
  if (response.status === 403) {
    if (/quota|storage/i.test(body)) {
      throw new DriveError("Google Drive is full. Free some space, then try again.");
    }
    throw new DriveError("Google Drive permission was denied. Connect again and allow NoteWise to save files it creates.");
  }
  if (response.status === 404) {
    throw new DriveError("That Drive backup could not be found. It may have been moved or deleted.");
  }
  if (response.status === 429) {
    throw new DriveError("Google Drive is busy. Wait a moment and try again.");
  }
  if (/quota|storage/i.test(body)) {
    throw new DriveError("Google Drive is full. Free some space, then try again.");
  }
  throw new DriveError("Google Drive could not finish that step. Try again.");
}

export async function listChildren(token: string, folderId: string, name?: string) {
  const parts = [`'${folderId}' in parents`, "trashed = false"];
  if (name) parts.push(`name = '${name.replace(/'/g, "\\'")}'`);
  const query = encodeURIComponent(parts.join(" and "));
  const response = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime)&pageSize=100&spaces=drive`,
  );
  const payload = (await response.json()) as { files?: DriveFile[] };
  return payload.files ?? [];
}

export async function findAppFolder(token: string, folderName: string, knownId?: string) {
  if (knownId) {
    try {
      const response = await driveFetch(
        token,
        `https://www.googleapis.com/drive/v3/files/${knownId}?fields=id,name,mimeType,trashed`,
      );
      const file = (await response.json()) as DriveFile & { trashed?: boolean };
      if (file.id && !file.trashed) return file.id;
    } catch {
      // Folder was deleted. Create a new one below.
    }
  }
  const query = encodeURIComponent(
    `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const response = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)&pageSize=10&spaces=drive`,
  );
  const payload = (await response.json()) as { files?: DriveFile[] };
  const existing = payload.files?.[0];
  if (existing?.id) return existing.id;

  const created = await driveFetch(token, "https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folder = (await created.json()) as DriveFile;
  if (!folder.id) throw new DriveError("The NoteWise folder could not be created on Google Drive.");
  return folder.id;
}

/**
 * Multipart upload (create or update). Media can be text or a photo Blob.
 * Updates by id so a second backup does not leave duplicate files.
 */
export async function uploadMultipart(
  token: string,
  input: {
    name: string;
    mimeType: string;
    parents?: string[];
    body: Blob | string;
    fileId?: string;
  },
) {
  const boundary = `notewise_${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata: Record<string, unknown> = {
    name: input.name,
    mimeType: input.mimeType,
  };
  if (!input.fileId && input.parents?.length) metadata.parents = input.parents;

  const mediaBlob = typeof input.body === "string" ? new Blob([input.body], { type: input.mimeType }) : input.body;
  const preamble = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
    ],
    { type: "application/octet-stream" },
  );
  const closing = new Blob([`\r\n--${boundary}--`], { type: "application/octet-stream" });
  const body = new Blob([preamble, mediaBlob, closing]);

  const path = input.fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${input.fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime";

  const response = await driveFetch(token, path, {
    method: input.fileId ? "PATCH" : "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const file = (await response.json()) as DriveFile;
  if (!file.id) throw new DriveError("The backup file could not be saved to Google Drive.");
  return file;
}

export async function downloadText(token: string, fileId: string) {
  const response = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return response.text();
}

export async function downloadBlob(token: string, fileId: string) {
  const response = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return response.blob();
}

export async function listManifests(token: string, folderId: string) {
  const files = await listChildren(token, folderId);
  return files
    .filter((file) => file.name.endsWith(".json") || file.mimeType === "application/json")
    .sort((left, right) => String(right.modifiedTime ?? "").localeCompare(String(left.modifiedTime ?? "")));
}
