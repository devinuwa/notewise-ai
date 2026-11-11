export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const WORKING_SIDE = 3200;
/** Colour JPEG for Gemini handwriting — keep detail, avoid harsh grayscale. */
const CLOUD_OCR_SIDE = 1600;
/** Grayscale JPEG for Tesseract — smaller and high-contrast. */
const DEVICE_OCR_SIDE = 1400;
const OCR_MAX_BYTES = 400 * 1024;

export type PreparedPage = {
  cropBlob: Blob;
  imageBlob: Blob;
  ocrBlob: Blob;
  preprocessMs: number;
};

export type OcrPrepKind = "cloud" | "device";

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("NoteWise could not open that photo. Try a JPEG or PNG."));
    image.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error("The page could not be saved as an image."));
          return;
        }
        // Some browsers return a PNG when they cannot encode the type you asked for.
        if (blob.type !== "image/jpeg") {
          reject(new Error("This browser could not save the page as a JPEG."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Halve the picture until one draw can finish the resize, which keeps notebook text clearer. */
function drawLongestSide(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  let width = sourceWidth;
  let height = sourceHeight;
  let current = source;

  while (width > targetWidth * 2 || height > targetHeight * 2) {
    width = Math.max(targetWidth, Math.floor(width / 2));
    height = Math.max(targetHeight, Math.floor(height / 2));
    const step = document.createElement("canvas");
    step.width = width;
    step.height = height;
    const stepContext = step.getContext("2d");
    if (!stepContext) throw new Error("This browser could not prepare the page.");
    stepContext.drawImage(current, 0, 0, width, height);
    current = step;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the page.");
  context.drawImage(current, 0, 0, targetWidth, targetHeight);
  return canvas;
}

function rotatedSize(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  };
}

async function renderCrop(sourceUrl: string, pixelCrop: PixelCrop, rotation: number) {
  const image = await loadImage(sourceUrl);
  const radians = (rotation * Math.PI) / 180;
  const box = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  const rotated = document.createElement("canvas");
  rotated.width = Math.max(1, Math.round(box.width));
  rotated.height = Math.max(1, Math.round(box.height));
  const rotatedContext = rotated.getContext("2d");
  if (!rotatedContext) throw new Error("This browser could not crop the page.");
  rotatedContext.translate(rotated.width / 2, rotated.height / 2);
  rotatedContext.rotate(radians);
  rotatedContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const x = Math.max(0, Math.round(pixelCrop.x));
  const y = Math.max(0, Math.round(pixelCrop.y));
  const width = Math.min(Math.round(pixelCrop.width), rotated.width - x);
  const height = Math.min(Math.round(pixelCrop.height), rotated.height - y);
  if (width < 8 || height < 8) {
    throw new Error("That crop is too small. Include more of the page.");
  }

  const cropped = document.createElement("canvas");
  cropped.width = width;
  cropped.height = height;
  const croppedContext = cropped.getContext("2d");
  if (!croppedContext) throw new Error("This browser could not crop the page.");
  croppedContext.drawImage(rotated, x, y, width, height, 0, 0, width, height);
  return cropped;
}

function fitted(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function blobFrom(canvas: OffscreenCanvas | HTMLCanvasElement, quality: number) {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    if (!blob || blob.size === 0 || blob.type !== "image/jpeg") {
      throw new Error("This browser could not save the page as a JPEG.");
    }
    return blob;
  }
  return canvasToJpeg(canvas, quality);
}

type DrawOptions = {
  maxSide: number;
  quality: number;
  /** CSS filter applied when drawing into the OCR canvas. */
  filter: string;
  /** Extra pixel pass after draw (device path only). */
  afterDraw?: (context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number) => void;
};

async function drawOcrJpeg(bitmap: ImageBitmap, options: DrawOptions) {
  const size = fitted(bitmap.width, bitmap.height, options.maxSide);
  const canvas =
    typeof OffscreenCanvas === "undefined"
      ? document.createElement("canvas")
      : new OffscreenCanvas(size.width, size.height);
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error("This browser could not prepare the page.");
  context.filter = options.filter;
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  context.filter = "none";
  options.afterDraw?.(context, size.width, size.height);
  return blobFrom(canvas, options.quality);
}

/** Mild contrast stretch so faint pencil / pen ink stands out without crushing shadows. */
function stretchContrast(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
) {
  try {
    const image = context.getImageData(0, 0, width, height);
    const pixels = image.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const value = pixels[i] ?? 0;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const range = Math.max(1, max - min);
    // Skip nearly blank / already-flat pages.
    if (range < 28) return;
    const scale = 255 / range;
    for (let i = 0; i < pixels.length; i += 4) {
      const value = Math.round(((pixels[i] ?? 0) - min) * scale);
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
    }
    context.putImageData(image, 0, 0);
  } catch {
    // Some OffscreenCanvas contexts refuse getImageData; CSS filters still applied.
  }
}

async function encodeWithinBudget(bitmap: ImageBitmap, kind: OcrPrepKind) {
  const startSide = kind === "cloud" ? CLOUD_OCR_SIDE : DEVICE_OCR_SIDE;
  const startQuality = kind === "cloud" ? 0.82 : 0.72;
  const filter =
    kind === "cloud"
      ? "contrast(1.08) saturate(0.92)"
      : "grayscale(1) contrast(1.35) brightness(1.04)";
  const afterDraw = kind === "device" ? stretchContrast : undefined;

  let side = startSide;
  let quality = startQuality;
  let blob = await drawOcrJpeg(bitmap, { maxSide: side, quality, filter, afterDraw });
  for (const next of kind === "cloud" ? [0.7, 0.55] : [0.55, 0.4]) {
    if (blob.size <= OCR_MAX_BYTES) break;
    quality = next;
    blob = await drawOcrJpeg(bitmap, { maxSide: side, quality, filter, afterDraw });
  }
  for (const next of kind === "cloud" ? [1280, 1024] : [1200, 960, 800]) {
    if (blob.size <= OCR_MAX_BYTES) break;
    side = next;
    blob = await drawOcrJpeg(bitmap, { maxSide: side, quality, filter, afterDraw });
  }
  return blob;
}

/**
 * JPEG for the reader.
 * - cloud: colour + light contrast (handwriting stays readable for Gemini)
 * - device: grayscale + stronger contrast (printed text for Tesseract)
 */
export async function makeOcrJpeg(source: Blob, kind: OcrPrepKind = "cloud") {
  const bitmap = await createImageBitmap(source);
  try {
    return await encodeWithinBudget(bitmap, kind);
  } finally {
    bitmap.close();
  }
}

/** Re-prep a stored colour OCR/crop blob for on-device Tesseract. */
export async function prepareForDeviceOcr(source: Blob) {
  return makeOcrJpeg(source, "device");
}

/** Shrink a huge camera photo before the crop tool, so the canvas stays within what phones can draw. */
export async function workingPhoto(file: Blob) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (longest <= WORKING_SIDE) {
      return { blob: file, url: sourceUrl };
    }
    const canvas = drawLongestSide(image, image.naturalWidth, image.naturalHeight, WORKING_SIDE);
    const blob = await canvasToJpeg(canvas, 0.92);
    URL.revokeObjectURL(sourceUrl);
    return { blob, url: URL.createObjectURL(blob) };
  } catch (error) {
    URL.revokeObjectURL(sourceUrl);
    throw error;
  }
}

export async function preparePageImage(sourceUrl: string, pixelCrop: PixelCrop, rotation: number): Promise<PreparedPage> {
  const cropped = await renderCrop(sourceUrl, pixelCrop, rotation);
  const cropBlob = await canvasToJpeg(cropped, 0.92);
  const started = performance.now();
  // Store the cloud-oriented blob; on-device reading re-preps just before Tesseract.
  const ocrBlob = await makeOcrJpeg(cropBlob, "cloud");
  return { cropBlob, imageBlob: cropBlob, ocrBlob, preprocessMs: Math.round(performance.now() - started) };
}

export async function frameToJpeg(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("The camera is not ready yet. Wait a moment and press the shutter again.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not take the photo.");
  context.drawImage(video, 0, 0);
  return canvasToJpeg(canvas, 0.92);
}
