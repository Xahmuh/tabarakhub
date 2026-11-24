import type { PDFPageProxy } from 'pdfjs-dist';

export function isPdfFile(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export async function openBrowserPdf(file: File) {
  const [pdfjs, worker, buffer] = await Promise.all([
    import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.mjs?url'), file.arrayBuffer()
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: buffer, isEvalSupported: false });
}

export async function renderBrowserPdfPage(page: PDFPageProxy, maxEdge: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const dimensions = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: maxEdge / Math.max(dimensions.width, dimensions.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const canvasContext = canvas.getContext('2d', { alpha: false });
  if (!canvasContext) throw new Error('This browser cannot render the PDF.');
  const job = page.render({ canvasContext, viewport, background: '#fff' });
  const cancel = () => job.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await job.promise;
    return canvas;
  } finally {
    signal?.removeEventListener('abort', cancel);
    page.cleanup();
  }
}
