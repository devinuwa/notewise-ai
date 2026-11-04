export type OcrProvider = "gemini" | "tesseract";

export type FlaggedWord = {
  text: string;
  index: number;
};

export type OcrResult = {
  text: string;
  flaggedWords: FlaggedWord[];
  provider: OcrProvider;
};

/** Cloud was asked for and the page was read on the device instead. */
export type OcrRun = {
  result: OcrResult;
  rawOcrText: string;
  usedFallback: boolean;
};
