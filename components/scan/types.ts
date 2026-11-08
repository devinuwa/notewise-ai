export type DraftPage = {
  id: string;
  sourceUrl: string;
  sourceBlob: Blob;
  cropBlob: Blob;
  imageBlob: Blob;
  ocrBlob: Blob;
  preprocessMs: number;
  previewUrl: string;
};

export type CropJob = {
  id: string;
  sourceUrl: string;
  sourceBlob: Blob;
  replaceId?: string;
  /** True when this job created the object URL and must revoke it if the crop is cancelled. */
  ownsSource: boolean;
};

export const PAGE_LIMIT = 20;
