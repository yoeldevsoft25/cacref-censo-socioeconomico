// Minify JPG/PNG images in the browser before upload.
// Strategy: load the image, resize so the longest side is at most MAX_DIM,
// re-encode as JPEG with quality. PDFs are passed through untouched.

export interface MinifyOptions {
  maxDimension?: number; // pixels on the longest side
  quality?: number; // 0..1 JPEG quality
  targetBytes?: number; // try to get under this; reduce quality if needed
  maxBytes?: number; // hard ceiling; if exceeded after minification, throw
}

const DEFAULTS: Required<MinifyOptions> = {
  maxDimension: 1920,
  quality: 0.75,
  targetBytes: 700 * 1024, // 700 KB soft target
  maxBytes: 5 * 1024 * 1024, // 5 MB hard ceiling
};

export class MinifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MinifyError';
  }
}

function isImage(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new MinifyError('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new MinifyError('Fallo al recomprimir la imagen.'))),
      type,
      quality
    );
  });
}

async function reencode(
  img: HTMLImageElement,
  maxDim: number,
  quality: number
): Promise<Blob> {
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MinifyError('Canvas 2D no disponible en este navegador.');
  // White background for PNGs with transparency to avoid black halos on JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToBlob(canvas, 'image/jpeg', quality);
}

/**
 * Minify an image file. If the file is not an image (e.g. PDF), it is returned as-is.
 * Returns a new File with the minified content, or the original if minification is not beneficial.
 */
export async function minifyImage(file: File, opts: MinifyOptions = {}): Promise<File> {
  const cfg = { ...DEFAULTS, ...opts };

  if (!isImage(file)) {
    // PDF or other binary — pass through. Caller should enforce the size limit.
    return file;
  }

  // If already under target, skip
  if (file.size <= cfg.targetBytes) {
    return file;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch (e) {
    // If we can't decode, return the original so upload still has a chance.
    if (e instanceof MinifyError) return file;
    throw e;
  }

  // First pass: reencode at requested quality
  let blob = await reencode(img, cfg.maxDimension, cfg.quality);

  // If still over target, drop quality in steps (min 0.5)
  let q = cfg.quality;
  while (blob.size > cfg.targetBytes && q > 0.5) {
    q = Math.max(0.5, q - 0.1);
    blob = await reencode(img, cfg.maxDimension, q);
  }

  // If still over target, reduce max dimension
  let dim = cfg.maxDimension;
  while (blob.size > cfg.targetBytes && dim > 800) {
    dim = Math.max(800, Math.round(dim * 0.75));
    blob = await reencode(img, dim, q);
  }

  if (blob.size > cfg.maxBytes) {
    throw new MinifyError(
      `La imagen comprimida (${formatBytes(blob.size)}) excede el límite de ${formatBytes(cfg.maxBytes)}. Use una imagen más pequeña.`
    );
  }

  const newName = file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
