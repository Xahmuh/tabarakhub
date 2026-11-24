import { isPdfFile, openBrowserPdf, renderBrowserPdfPage } from './browserPdf';

export const LMRA_MAX_JPEG_BYTES = 150_000;
const maxImageEdge = 2400;

export type CompressedPage = { name: string; blob: Blob };

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.type === 'image/jpeg') resolve(blob);
      else reject(new Error('This browser could not encode a JPG.'));
    }, 'image/jpeg', quality);
  });
}

async function fitJpeg(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
  if (sourceWidth < 1 || sourceHeight < 1) throw new Error('The image has no visible content.');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser cannot process images.');
  let scale = Math.min(1, maxImageEdge / Math.max(sourceWidth, sourceHeight));
  for (;;) {
    canvas.width = Math.max(1, Math.floor(sourceWidth * scale));
    canvas.height = Math.max(1, Math.floor(sourceHeight * scale));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const high = await encodeJpeg(canvas, 0.94);
    if (high.size <= LMRA_MAX_JPEG_BYTES) return high;
    let best = await encodeJpeg(canvas, 0.55);
    if (best.size <= LMRA_MAX_JPEG_BYTES) {
      let lowQuality = 0.55;
      let highQuality = 0.94;
      for (let attempt = 0; attempt < 6; attempt++) {
        const quality = (lowQuality + highQuality) / 2;
        const candidate = await encodeJpeg(canvas, quality);
        if (candidate.size <= LMRA_MAX_JPEG_BYTES) {
          best = candidate;
          lowQuality = quality;
        } else {
          highQuality = quality;
        }
      }
      return best;
    }
    if (canvas.width === 1 && canvas.height === 1) throw new Error('Could not meet the JPG size limit.');
    scale *= Math.max(0.5, Math.min(0.85, Math.sqrt(LMRA_MAX_JPEG_BYTES / best.size)));
  }
}

export async function squeezeLmraFile(file: File, prefix: string, onPage: (page: CompressedPage) => void) {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100) || 'document';
  const pageName = (number: number, count: number) =>
    `${prefix}${base}-page-${String(number).padStart(String(count).length, '0')}.jpg`;
  if (isPdfFile(file)) {
    const task = await openBrowserPdf(file);
    try {
      const pdf = await task.promise;
      const failedPages: number[] = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        try {
          const page = await pdf.getPage(index);
          const canvas = await renderBrowserPdfPage(page, maxImageEdge);
          const blob = await fitJpeg(canvas, canvas.width, canvas.height);
          onPage({ name: pageName(index, pdf.numPages), blob });
        } catch {
          failedPages.push(index);
        }
      }
      if (failedPages.length) throw new Error(`Could not convert PDF pages: ${failedPages.join(', ')}.`);
    } finally {
      await task.destroy();
    }
    return;
  }

  if (/\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)) {
    const { heicTo } = await import('heic-to/csp');
    const bitmap = await heicTo({ blob: file, type: 'bitmap' });
    try {
      onPage({ name: `${prefix}${base}.jpg`, blob: await fitJpeg(bitmap, bitmap.width, bitmap.height) });
    } finally {
      bitmap.close();
    }
    return;
  }

  if (/\.tiff?$/i.test(file.name) || file.type === 'image/tiff') {
    const [{ decode, decodeImage, toRGBA8 }, buffer] = await Promise.all([import('utif'), file.arrayBuffer()]);
    const pages = decode(buffer).filter(page => Array.isArray(page.t256) && Array.isArray(page.t257));
    if (!pages.length) throw new Error('No readable pages in this TIFF.');
    for (const [index, page] of pages.entries()) {
      const width = Number((page.t256 as number[])[0]);
      const height = Number((page.t257 as number[])[0]);
      if (!(width > 0 && height > 0) || width * height > 50_000_000) throw new Error('TIFF page dimensions are unsupported.');
      decodeImage(buffer, page);
      const rgba = new Uint8ClampedArray(toRGBA8(page));
      const bitmap = await createImageBitmap(new ImageData(rgba, page.width, page.height));
      try {
        const blob = await fitJpeg(bitmap, bitmap.width, bitmap.height);
        onPage({ name: pages.length === 1 ? `${prefix}${base}.jpg` : pageName(index + 1, pages.length), blob });
      } finally {
        bitmap.close();
      }
    }
    return;
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error('This image format is unsupported by your browser or the file is invalid.');
    }
    const blob = await fitJpeg(image, image.naturalWidth, image.naturalHeight);
    onPage({ name: `${prefix}${base}.jpg`, blob });
  } finally {
    URL.revokeObjectURL(url);
  }
}
