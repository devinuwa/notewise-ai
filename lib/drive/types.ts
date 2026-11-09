export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_FOLDER_NAME = "NoteWise";
export const DRIVE_MANIFEST_NAME = "notewise-manifest.json";

export type DriveToken = {
  accessToken: string;
  /** Epoch ms when the token should be treated as expired. */
  expiresAt: number;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
};

export type ManifestPage = {
  id: string;
  topicId: string;
  subjectId: string;
  rawOcrText: string;
  text: string;
  flaggedWords: { text: string; index: number }[];
  ocrProvider: string;
  status: "needs-review" | "digitized";
  createdAt: number;
  correctedAt?: number;
  driveFileId?: string;
  flagsFixed?: number;
  ocrError?: string;
  photoFileId?: string;
};

export type NoteWiseManifest = {
  app: "NoteWise";
  version: 1;
  exportedAt: string;
  includePhotos: boolean;
  settings: {
    name: string;
    aiConsent: boolean;
    ocrMode: "cloud" | "on-device";
    examDate?: number;
    voiceURI?: string;
    speechRate?: number;
  } | null;
  subjects: { id: string; name: string; color: string; createdAt: number }[];
  topics: { id: string; subjectId: string; name: string; createdAt: number }[];
  notePages: ManifestPage[];
  quizzes: unknown[];
  chatMessages?: unknown[];
  examPapers: unknown[];
  examSheets: unknown[];
  examProfiles: unknown[];
};

export type RestoreMode = "merge" | "replace";
