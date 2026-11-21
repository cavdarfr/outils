/// <reference lib="webworker" />
import { MIME, fitWithin, isHeif, type OutputFormat } from './logic';
import { LIBHEIF_URL } from './vendor';

export interface ConvertRequest {
  id: number;
  file: File;
  format: OutputFormat;
  quality: number;
  maxSide: number | null;
  pixelBudget: number;
}

export type ConvertResponse =
  | { id: number; ok: true; blob: Blob; width: number; height: number; decoder: 'natif' | 'libheif' }
  | { id: number; ok: false; error: string };

type Libheif = {
  HeifDecoder: new () => {
    decode(data: Uint8Array): Array<{
      get_width(): number;
      get_height(): number;
      display(target: { data: Uint8ClampedArray; width: number; height: number }, cb: (r: unknown) => void): void;
      free(): void;
    }>;
  };
};

type LibheifFactory = (options?: { onRuntimeInitialized?: () => void }) => unknown;

let libheifPromise: Promise<Libheif> | null = null;

/** Charge libheif (WASM, environ 2 Mo) uniquement si le navigateur ne sait pas décoder le HEIC. */
function loadLibheif(): Promise<Libheif> {
  libheifPromise ??= (import(/* @vite-ignore */ LIBHEIF_URL) as Promise<{ default: LibheifFactory }>).then(async ({ default: factory }) => {
    // Le rappel peut être appelé pendant l'appel à factory (WASM embarqué, instanciation synchrone).
    let lib: unknown;
    await new Promise<void>((resolve) => {
      lib = factory({ onRuntimeInitialized: resolve });
    });
    return lib as Libheif;
  });
  return libheifPromise;
}

async function decodeWithLibheif(bytes: Uint8Array, budget: number): Promise<ImageBitmap> {
  const lib = await loadLibheif();
  const images = new lib.HeifDecoder().decode(bytes);
  const image = images[0];
  if (!image) throw new Error('Fichier HEIC illisible ou vide.');
  try {
    const width = image.get_width();
    const height = image.get_height();
    if (width * height > budget) throw new Error(tooLarge(width, height));
    const data = new Uint8ClampedArray(width * height * 4);
    await new Promise<void>((resolve, reject) =>
      image.display({ data, width, height }, (result) => (result ? resolve() : reject(new Error('Décodage HEIC impossible.')))),
    );
    return await createImageBitmap(new ImageData(data, width, height));
  } finally {
    for (const img of images) img.free();
  }
}

function tooLarge(width: number, height: number): string {
  const mp = Math.round((width * height) / 1_000_000);
  return `Image trop grande pour cet appareil (${mp} mégapixels). Utilisez un ordinateur pour cette image.`;
}

async function decode(file: File, budget: number): Promise<{ bitmap: ImageBitmap; decoder: 'natif' | 'libheif' }> {
  try {
    return { bitmap: await createImageBitmap(file), decoder: 'natif' };
  } catch {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isHeif(bytes)) return { bitmap: await decodeWithLibheif(bytes, budget), decoder: 'libheif' };
    throw new Error("Format non reconnu par ce navigateur. Formats acceptés : HEIC, HEIF, WebP, AVIF, PNG, JPG, GIF.");
  }
}

async function convert(req: ConvertRequest): Promise<ConvertResponse> {
  const { bitmap, decoder } = await decode(req.file, req.pixelBudget);
  try {
    // Le décodage natif a déjà eu lieu ; ce contrôle évite au moins d'allouer en plus le canvas de sortie.
    if (bitmap.width * bitmap.height > req.pixelBudget) throw new Error(tooLarge(bitmap.width, bitmap.height));
    const size = fitWithin(bitmap.width, bitmap.height, req.maxSide);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible dans ce navigateur.');
    if (req.format === 'jpeg') {
      // Le JPG ne gère pas la transparence : fond blanc plutôt que noir.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvas.convertToBlob({ type: MIME[req.format], quality: req.quality });
    return { id: req.id, ok: true, blob, width: size.width, height: size.height, decoder };
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (event: MessageEvent<ConvertRequest>) => {
  const req = event.data;
  let response: ConvertResponse;
  try {
    response = await convert(req);
  } catch (error) {
    response = { id: req.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
