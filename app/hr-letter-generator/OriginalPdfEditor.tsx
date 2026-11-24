import { Fragment, useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { RegisteredCr } from '../lib/crEntities';
import { isPdfFile, openBrowserPdf, renderBrowserPdfPage } from '../lib/browserPdf';
import { DraggableMark, PlacementField } from './LetterMarkControls';
import { letterPageSize, loadLetterMarks, markShowsOnPage, markSizes } from './letterHeadPdf';
import type { MarkKind, MarkPlacement, PageMarkPositions } from './letterHeadPdf';

type PageSize = { width: number; height: number };
type PagePreview = { index: number; src: string; size: PageSize };

function markBox(page: PageSize, kind: MarkKind) {
  const scale = Math.min(page.width / letterPageSize.width, page.height / letterPageSize.height);
  const margin = 45 * scale;
  const width = markSizes[kind].width * scale;
  const height = markSizes[kind].height * scale;
  return { width, height, x: kind === 'signature' ? margin : page.width - margin - width, y: page.height - margin - height };
}

export function OriginalPdfEditor({ company, companies, onCompanyChange }: {
  company: RegisteredCr | undefined;
  companies: RegisteredCr[];
  onCompanyChange: (id: string) => void;
}) {
  const [file, setFile] = useState<File>();
  const [source, setSource] = useState<{ pdf: PDFDocumentProxy; file: File }>();
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState<PagePreview>();
  const [signature, setSignature] = useState<MarkPlacement>('off');
  const [stamp, setStamp] = useState<MarkPlacement>('off');
  const [positions, setPositions] = useState<PageMarkPositions>({});
  const [markState, setMarkState] = useState<{
    company: RegisteredCr; signature: MarkPlacement; stamp: MarkPlacement;
    marks: Awaited<ReturnType<typeof loadLetterMarks>>;
  }>();
  const [error, setError] = useState('');
  const [markError, setMarkError] = useState('');
  const [saving, setSaving] = useState(false);
  const current = source?.file === file ? source : undefined;
  const marks = markState?.company === company && markState?.signature === signature && markState?.stamp === stamp
    ? markState.marks : undefined;

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let task: Awaited<ReturnType<typeof openBrowserPdf>> | undefined;
    async function load(input: File) {
      try {
        task = await openBrowserPdf(input);
        if (cancelled) { await task.destroy(); return; }
        const pdf = await task.promise;
        if (!cancelled) setSource({ pdf, file: input });
      } catch {
        if (!cancelled) setError('Could not open this PDF. Use a valid PDF without password protection.');
      }
    }
    void load(file);
    return () => { cancelled = true; if (task) void task.destroy().catch(() => {}); };
  }, [file]);

  useEffect(() => {
    if (!current) return;
    const controller = new AbortController();
    current.pdf.getPage(index + 1).then(async page => {
      const size = page.getViewport({ scale: 1 });
      const canvas = await renderBrowserPdfPage(page, 1400, controller.signal);
      if (!controller.signal.aborted) setPreview({ index, src: canvas.toDataURL('image/png'), size });
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not preview this page.');
    });
    return () => controller.abort();
  }, [current, index]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setMarkError('');
    loadLetterMarks(company, signature, stamp).then(loaded => {
      if (!cancelled) setMarkState({ company, signature, stamp, marks: loaded });
    }).catch(() => {
      if (!cancelled) setMarkError('Could not load the selected signature or seal.');
    });
    return () => { cancelled = true; };
  }, [company, signature, stamp]);

  async function save() {
    if (!current || !marks?.some(mark => mark.src)) return;
    setSaving(true);
    setError('');
    try {
      const [{ PDFDocument, degrees }, bytes] = await Promise.all([import('pdf-lib'), current.file.arrayBuffer()]);
      const output = await PDFDocument.load(bytes, { updateMetadata: false });
      for (const mark of marks) {
        if (!mark.src) continue;
        const image = await output.embedPng(mark.src);
        for (let i = 0; i < current.pdf.numPages; i++) {
          if (!markShowsOnPage(mark.placement, i, current.pdf.numPages)) continue;
          const page = await current.pdf.getPage(i + 1);
          const viewport = page.getViewport({ scale: 1 });
          const box = markBox(viewport, mark.kind);
          const { x, y } = positions[i]?.[mark.kind] ?? box;
          const [left, bottom] = viewport.convertToPdfPoint(x, y + box.height);
          const [rightX, rightY] = viewport.convertToPdfPoint(x + box.width, y + box.height);
          const [topX, topY] = viewport.convertToPdfPoint(x, y);
          output.getPage(i).drawImage(image, {
            x: left, y: bottom,
            width: Math.hypot(rightX - left, rightY - bottom),
            height: Math.hypot(topX - left, topY - bottom),
            rotate: degrees(Math.atan2(rightY - bottom, rightX - left) * 180 / Math.PI)
          });
        }
      }
      const result = await output.save({ updateFieldAppearances: false });
      saveAs(new Blob([new Uint8Array(result)], { type: 'application/pdf' }), current.file.name.replace(/\.pdf$/i, '') + ' - stamped.pdf');
    } catch {
      setError('Could not save this PDF. Encrypted PDFs are not supported.');
    } finally {
      setSaving(false);
    }
  }

  const displayed = current && preview?.index === index ? preview : undefined;
  const canSave = !!displayed && !!marks?.some(mark => mark.src) && !saving;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Original PDF</span>
          <input type="file" accept="application/pdf,.pdf" className="block min-h-11 w-full"
            onChange={event => {
              const input = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!input) return;
              if (!isPdfFile(input)) { setError('Choose a PDF file.'); return; }
              setError('');
              setFile(input);
              setSource(undefined);
              setPreview(undefined);
              setIndex(0);
              setPositions({});
            }} />
          {file && <span className="block break-words font-normal">{file.name}</span>}
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Company</span>
          <select value={company?.id ?? ''} onChange={event => onCompanyChange(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
            {companies.map(item => <option value={item.id} key={item.id}>{item.cr_name} · CR {item.cr_number}</option>)}
          </select>
        </label>
        <PlacementField label="Signature" value={signature} onChange={setSignature} />
        <PlacementField label="Company seal" value={stamp} onChange={setStamp} />
      </fieldset>
      {(error || markError) && <p role="alert" className="text-sm text-red-700">{error || markError}</p>}
      {file && !displayed && !error && <p role="status" className="text-sm text-slate-600">Rendering PDF preview…</p>}
      {current && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-semibold">
            Page
            <select disabled={saving} value={index} onChange={event => {
              setError(''); setIndex(Number(event.target.value));
            }} className="min-h-11 rounded-lg border border-slate-300 px-3">
              {Array.from({ length: current.pdf.numPages }, (_, i) => <option key={i} value={i}>{i + 1} of {current.pdf.numPages}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary min-h-11 px-3" disabled={saving}
            onClick={() => setPositions({})}>Reset positions</button>
          <button type="button" className="btn-primary min-h-11 px-3" disabled={!canSave}
            onClick={() => void save()}>{saving ? 'Saving…' : 'Save as PDF'}</button>
        </div>
      )}
      {displayed && (
        <>
          <p id="original-pdf-mark-instructions" className="text-sm text-slate-600">Drag the signature or seal on the preview, or use the arrow keys. Each page keeps its own positions.</p>
          <div className="relative mx-auto max-w-[900px] bg-white ring-1 ring-slate-300"
            style={{ aspectRatio: `${displayed.size.width} / ${displayed.size.height}` }}>
            <img src={displayed.src} alt={`Original PDF, page ${index + 1}`} className="block h-full w-full" />
            {marks?.map(mark => {
              if (!mark.src || !markShowsOnPage(mark.placement, index, current.pdf.numPages)) return null;
              const box = markBox(displayed.size, mark.kind);
              return <Fragment key={`${index}:${mark.kind}`}><DraggableMark kind={mark.kind} pageNumber={index + 1}
                src={mark.src} pageSize={displayed.size} size={box} disabled={saving} instructionsId="original-pdf-mark-instructions"
                position={positions[index]?.[mark.kind] ?? box}
                onMove={({ x, y }) => setPositions(previous => ({
                  ...previous, [index]: { ...previous[index], [mark.kind]: {
                    x: Math.max(0, Math.min(displayed.size.width - box.width, x)),
                    y: Math.max(0, Math.min(displayed.size.height - box.height, y))
                  } }
                }))} /></Fragment>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
