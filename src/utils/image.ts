import exifr from "exifr";
import { computeImageFeatures } from "@/utils/imageFeatures";
import type { ExifSummary, ImageFeatures } from "@/utils/types";

const PREVIEW_MAX_EDGE = 1568;
const FEATURES_MAX_EDGE = 320;
const PREVIEW_PIXELS_MAX_EDGE = 720;
const JPEG_QUALITY = 0.9;

const EXIF_TAGS = [
  "Make",
  "Model",
  "LensModel",
  "FocalLength",
  "FocalLengthIn35mmFormat",
  "FNumber",
  "ExposureTime",
  "ISO",
  "DateTimeOriginal",
];

export interface PreparedImage {
  previewUrl: string;
  /** Copie réduite servant à simuler les rendus. */
  previewPixels: ImageData;
  exif: ExifSummary | null;
  features: ImageFeatures;
}

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const toText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const readExif = async (file: File): Promise<ExifSummary | null> => {
  try {
    const tags: Record<string, unknown> | undefined = await exifr.parse(file, { pick: EXIF_TAGS });
    if (!tags) return null;
    const capturedAt = tags.DateTimeOriginal;
    return {
      camera: toText([toText(tags.Make), toText(tags.Model)].filter(Boolean).join(" ")),
      lensModel: toText(tags.LensModel),
      focalLength35: toNumber(tags.FocalLengthIn35mmFormat),
      fNumber: toNumber(tags.FNumber),
      exposureTime: toNumber(tags.ExposureTime),
      iso: toNumber(tags.ISO),
      capturedHour: capturedAt instanceof Date ? capturedAt.getHours() : null,
    };
  } catch {
    return null;
  }
};

const decode = async (file: File): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // HEIC/HEIF : non décodé nativement hors Safari, conversion en JPEG.
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: JPEG_QUALITY });
    return createImageBitmap(Array.isArray(converted) ? converted[0] : converted);
  }
};

const get2dContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D indisponible");
  return context;
};

const drawScaled = (bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement => {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  get2dContext(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const prepareImage = async (file: File): Promise<PreparedImage> => {
  const [exif, bitmap] = await Promise.all([readExif(file), decode(file)]);
  const previewUrl = drawScaled(bitmap, PREVIEW_MAX_EDGE).toDataURL("image/jpeg", JPEG_QUALITY);
  const featuresCanvas = drawScaled(bitmap, FEATURES_MAX_EDGE);
  const pixelsCanvas = drawScaled(bitmap, PREVIEW_PIXELS_MAX_EDGE);
  bitmap.close();

  return {
    previewUrl,
    previewPixels: get2dContext(pixelsCanvas).getImageData(0, 0, pixelsCanvas.width, pixelsCanvas.height),
    exif,
    features: computeImageFeatures(
      get2dContext(featuresCanvas).getImageData(0, 0, featuresCanvas.width, featuresCanvas.height),
    ),
  };
};
