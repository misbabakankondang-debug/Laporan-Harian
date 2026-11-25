export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  qualityUsed: number;
}

export interface CompressEvidenceOptions {
  maxDimension?: number;
  initialQuality?: number;
  targetMaxBytes?: number;
  maxInputBytes?: number;
}

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_INITIAL_QUALITY = 0.75;
const DEFAULT_TARGET_MAX_BYTES = 250 * 1024; // 250 KB
const DEFAULT_MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca hasil kompresi gambar.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal mengonversi gambar ke format data URL.'));
    reader.readAsDataURL(blob);
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Browser gagal menghasilkan file JPEG terkompresi.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

async function decodeImageSource(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, targetW: number, targetH: number) => void;
  cleanup: () => void;
}> {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const bitmap = await globalThis.createImageBitmap(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, targetW, targetH) => {
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        },
        cleanup: () => {
          try {
            bitmap.close();
          } catch {}
        },
      };
    } catch {
      // Lanjutkan ke fallback HTMLImageElement bila opsi imageOrientation tidak didukung browser
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, targetW, targetH) => {
          ctx.drawImage(img, 0, 0, targetW, targetH);
        },
        cleanup: () => {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`File "${file.name}" tidak dapat dibaca sebagai gambar yang valid.`));
    };
    img.src = objectUrl;
  });
}

function buildJpegFileName(originalName: string): string {
  const base = String(originalName || 'eviden_foto')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 60);
  return `${base || 'eviden_foto'}.jpg`;
}

export function validateEvidenceImageFile(
  file: File,
  maxInputBytes = DEFAULT_MAX_INPUT_BYTES
): string | null {
  if (!file) {
    return 'Berkas foto tidak ditemukan.';
  }
  const isImageMime = Boolean(file.type && file.type.toLowerCase().startsWith('image/'));
  const isImageExt = ALLOWED_IMAGE_EXTENSIONS.test(file.name || '');
  if (!isImageMime && !isImageExt) {
    return `File "${file.name}" bukan gambar. Eviden hanya mendukung format foto (JPG, PNG, WEBP).`;
  }
  if (file.size <= 0) {
    return `File "${file.name}" kosong atau rusak.`;
  }
  if (file.size > maxInputBytes) {
    const maxMb = Math.round(maxInputBytes / (1024 * 1024));
    return `Ukuran file "${file.name}" melebihi batas maksimum ${maxMb} MB sebelum kompresi.`;
  }
  return null;
}

export async function compressEvidenceImage(
  file: File,
  options: CompressEvidenceOptions = {}
): Promise<CompressedImageResult> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const initialQuality = options.initialQuality ?? DEFAULT_INITIAL_QUALITY;
  const targetMaxBytes = options.targetMaxBytes ?? DEFAULT_TARGET_MAX_BYTES;
  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;

  const validationError = validateEvidenceImageFile(file, maxInputBytes);
  if (validationError) {
    throw new Error(validationError);
  }

  const decoded = await decodeImageSource(file);

  try {
    if (!decoded.width || !decoded.height) {
      throw new Error(`Dimensi gambar "${file.name}" tidak valid.`);
    }

    // Pertahankan rasio asli dan jangan pernah memperbesar gambar yang sudah kecil
    const scale = Math.min(1, maxDimension / decoded.width, maxDimension / decoded.height);
    let targetW = Math.max(1, Math.round(decoded.width * scale));
    let targetH = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    const renderOnCanvas = (w: number, h: number) => {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Konteks Canvas 2D tidak tersedia di browser.');
      }
      // Isi latar putih agar gambar transparan (PNG/WEBP) tetap rapi saat dikonversi ke JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      decoded.draw(ctx, w, h);
    };

    renderOnCanvas(targetW, targetH);

    // Kualitas awal 75%, lalu turunkan bertahap jika ukuran masih > 250 KB (tetap jaga keterbacaan)
    const qualitySteps = [initialQuality, 0.65, 0.56, 0.48];
    let bestBlob = await canvasToJpegBlob(canvas, qualitySteps[0]);
    let qualityUsed = qualitySteps[0];

    for (let i = 1; i < qualitySteps.length && bestBlob.size > targetMaxBytes; i++) {
      const candidateBlob = await canvasToJpegBlob(canvas, qualitySteps[i]);
      bestBlob = candidateBlob;
      qualityUsed = qualitySteps[i];
    }

    // Jika foto beresolusi padat masih > 350 KB setelah kualitas 0.48, perkecil batas sisi ke 1024px (jika lebih besar)
    if (bestBlob.size > 350 * 1024 && Math.max(targetW, targetH) > 1024) {
      const reducedScale = Math.min(1, 1024 / decoded.width, 1024 / decoded.height);
      const nextW = Math.max(1, Math.round(decoded.width * reducedScale));
      const nextH = Math.max(1, Math.round(decoded.height * reducedScale));
      if (nextW < targetW || nextH < targetH) {
        targetW = nextW;
        targetH = nextH;
        renderOnCanvas(targetW, targetH);
        bestBlob = await canvasToJpegBlob(canvas, 0.6);
        qualityUsed = 0.6;
        if (bestBlob.size > targetMaxBytes) {
          bestBlob = await canvasToJpegBlob(canvas, 0.5);
          qualityUsed = 0.5;
        }
      }
    }

    if (bestBlob.size > 2 * 1024 * 1024) {
      throw new Error(
        `Ukuran hasil kompresi "${file.name}" masih terlalu besar (${Math.round(bestBlob.size / 1024)} KB).`
      );
    }

    const jpegName = buildJpegFileName(file.name);
    const compressedFile = new File([bestBlob], jpegName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    const dataUrl = await blobToDataUrl(bestBlob);

    return {
      file: compressedFile,
      dataUrl,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      width: targetW,
      height: targetH,
      qualityUsed,
    };
  } finally {
    decoded.cleanup();
  }
}
