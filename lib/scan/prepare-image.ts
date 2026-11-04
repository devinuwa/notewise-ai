export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MAX_SAVED_SIDE = 1600;
const WORKING_SIDE = 3200;
const TARGET_BYTES = Math.floor(1.5 * 1024 * 1024);

export type PreparedPage = {
  cropBlob: Blob;
  imageBlob: Blob;
};

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

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyMildContrast(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const amount = 1.12;
  const image = ctx.getImageData(0, 0, width, height);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = clampByte((pixels[index] - 128) * amount + 128);
    pixels[index + 1] = clampByte((pixels[index + 1] - 128) * amount + 128);
    pixels[index + 2] = clampByte((pixels[index + 2] - 128) * amount + 128);
  }
  ctx.putImageData(image, 0, 0);
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

async function cleanedJpeg(cropped: HTMLCanvasElement) {
  let quality = 0.8;
  let maxSide = MAX_SAVED_SIDE;
  let blob = await canvasToJpeg(withContrast(cropped, maxSide), quality);
  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality = Math.round((quality - 0.1) * 10) / 10;
    blob = await canvasToJpeg(withContrast(cropped, maxSide), quality);
  }
  while (blob.size > TARGET_BYTES && maxSide > 800) {
    maxSide -= 200;
    blob = await canvasToJpeg(withContrast(cropped, maxSide), quality);
  }
  if (blob.size > TARGET_BYTES) {
    throw new Error("That page is still over 1.5 MB. Crop a smaller area and try again.");
  }
  return blob;
}

function withContrast(cropped: HTMLCanvasElement, maxSide: number) {
  const canvas = drawLongestSide(cropped, cropped.width, cropped.height, maxSide);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the page.");
  applyMildContrast(context, canvas.width, canvas.height);
  return canvas;
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
  const imageBlob = await cleanedJpeg(cropped);
  return { cropBlob, imageBlob };
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
