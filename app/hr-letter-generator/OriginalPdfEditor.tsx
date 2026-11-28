import { Fragment, useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { RegisteredCr } from '../lib/crEntities';
import { isPdfFile, openBrowserPdf, renderBrowserPdfPage } from '../lib/browserPdf';
import { AddTodayDateField, DraggableMark, PlacementField } from './LetterMarkControls';
import { letterheadBandHeight, letterPageSize, loadLetterMarks, markShowsOnPage, markSizes, renderCompanyLetterhead } from './letterHeadPdf';
import type { MarkKind, MarkPlacement, MarkPosition, PageMarkPositions } from './letterHeadPdf';

type PageSize = { width: number; height: number };
type PagePreview = { index: number; src: string; size: PageSize };
type HeaderPlacement = 'off' | 'first' | 'all';
type MarkScales = Partial<Record<number, Partial<Record<MarkKind, number>>>>;
type PdfViewport = ReturnType<PDFPageProxy['getViewport']>;

function getPageLayout(size: PageSize, hasHeader: boolean) {
  const headerHeight = hasHeader ? letterheadBandHeight * size.width / letterPageSize.width : 0;
  return { width: size.width, height: size.height + headerHeight, headerHeight };
}

function markBox(page: ReturnType<typeof getPageLayout>, kind: MarkKind, zoom: number, position?: MarkPosition) {
  const scale = Math.min(page.width / letterPageSize.width, (page.height - page.headerHeight) / letterPageSize.height);
  const margin = 45 * scale;
  const width = markSizes[kind].width * scale * zoom;
  const height = markSizes[kind].height * scale * zoom;
  const x = position?.x ?? (kind === 'signature' ? margin : page.width - margin - width);
  const y = position?.y ?? (kind === 'date' ? page.headerHeight + margin : page.height - margin - height);
  return { width, height, x: Math.max(0, Math.min(page.width - width, x)), y: Math.max(0, Math.min(page.height - height, y)) };
}

function overlayTransform(viewport: PdfViewport, x: number, top: number, width: number, height: number) {
  const [left, bottom] = viewport.convertToPdfPoint(x, top + height);
  const [rightX, rightY] = viewport.convertToPdfPoint(x + width, top + height);
  const [topX, topY] = viewport.convertToPdfPoint(x, top);
  return {
    x: left, y: bottom,
    width: Math.hypot(rightX - left, rightY - bottom),
    height: Math.hypot(topX - left, topY - bottom),
    angle: Math.atan2(rightY - bottom, rightX - left) * 180 / Math.PI
  };
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
  const [headerPlacement, setHeaderPlacement] = useState<HeaderPlacement>('first');
  const [showDate, setShowDate] = useState(false);
  const [positions, setPositions] = useState<PageMarkPositions>({});
  const [scales, setScales] = useState<MarkScales>({});
  const [markState, setMarkState] = useState<{
    company: RegisteredCr; signature: MarkPlacement; stamp: MarkPlacement; showDate: boolean; headerPlacement: HeaderPlacement;
    letterhead: string | null;
    marks: Awaited<ReturnType<typeof loadLetterMarks>>;
  }>();
  const [error, setError] = useState('');
  const [markError, setMarkError] = useState('');
  const [saving, setSaving] = useState(false);
  const current = source?.file === file ? source : undefined;
  const assets = markState?.company === company && markState?.signature === signature &&
    markState?.stamp === stamp && markState?.showDate === showDate && markState?.headerPlacement === headerPlacement
    ? markState : undefined;

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
    Promise.all([
      loadLetterMarks(company, signature, stamp, showDate),
      headerPlacement === 'off' ? null : renderCompanyLetterhead(company)
    ]).then(([marks, letterhead]) => {
      if (!cancelled) setMarkState({ company, signature, stamp, showDate, headerPlacement, marks, letterhead });
    }).catch(() => {
      if (!cancelled) setMarkError('Could not prepare the company letterhead or selected marks.');
    });
    return () => { cancelled = true; };
  }, [company, signature, stamp, showDate, headerPlacement]);

  const changeScale = (kind: MarkKind, scale: number) => {
    const clamped = Math.max(0.4, Math.min(2.5, scale));
    setScales(previous => ({ ...previous, [index]: { ...previous[index], [kind]: clamped } }));
  };

  async function save() {
    if (!current || !assets || (!assets.letterhead && !assets.marks.some(mark => mark.src))) return;
    setSaving(true);
    setError('');
    try {
      const [{ PDFDocument, degrees }, bytes] = await Promise.all([import('pdf-lib'), current.file.arrayBuffer()]);
      const output = await PDFDocument.load(bytes, { updateMetadata: false });
      const letterhead = assets.letterhead ? await output.embedPng(assets.letterhead) : null;
      const overlays = await Promise.all(assets.marks.map(async mark => ({
        ...mark, image: mark.src ? await output.embedPng(mark.src) : null
      })));
      for (let i = 0; i < current.pdf.numPages; i++) {
        const hasHeader = !!letterhead && markShowsOnPage(headerPlacement, i, current.pdf.numPages);
        const selectedMarks = overlays.filter(mark => mark.image && markShowsOnPage(mark.placement, i, current.pdf.numPages));
        if (!hasHeader && !selectedMarks.length) continue;
        const page = output.getPage(i);
        const viewport = (await current.pdf.getPage(i + 1)).getViewport({ scale: 1 });
        const layout = getPageLayout(viewport, hasHeader);
        if (hasHeader && letterhead) {
          const [aX, aY] = viewport.convertToPdfPoint(0, -layout.headerHeight);
          const [bX, bY] = viewport.convertToPdfPoint(viewport.width, viewport.height);
          const cropX = Math.min(aX, bX);
          const cropY = Math.min(aY, bY);
          const media = page.getMediaBox();
          const mediaX = Math.min(media.x, cropX);
          const mediaY = Math.min(media.y, cropY);
          page.setMediaBox(mediaX, mediaY,
            Math.max(media.x + media.width, aX, bX) - mediaX,
            Math.max(media.y + media.height, aY, bY) - mediaY);
          page.setCropBox(cropX, cropY, Math.abs(aX - bX), Math.abs(aY - bY));
          const { angle, ...transform } = overlayTransform(viewport, 0, -layout.headerHeight, layout.width, layout.headerHeight);
          page.drawImage(letterhead, { ...transform, rotate: degrees(angle) });
        }
        for (const mark of selectedMarks) {
          if (!mark.image) continue;
          const box = markBox(layout, mark.kind, scales[i]?.[mark.kind] ?? 1, positions[i]?.[mark.kind]);
          const { angle, ...transform } = overlayTransform(viewport, box.x, box.y - layout.headerHeight, box.width, box.height);
          page.drawImage(mark.image, { ...transform, rotate: degrees(angle) });
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
  const canSave = !!displayed && !!assets && (!!assets.letterhead || assets.marks.some(mark => mark.src)) && !saving;
  const activeHeader = !!current && !!assets?.letterhead && markShowsOnPage(headerPlacement, index, current.pdf.numPages);
  const layout = displayed ? getPageLayout(displayed.size, activeHeader) : null;
  const activeMarks = current ? assets?.marks.filter(mark =>
    mark.src && markShowsOnPage(mark.placement, index, current.pdf.numPages)
  ) ?? [] : [];
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
              setScales({});
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
        <label className="block space-y-2 text-sm font-semibold">
          <span>Company letterhead</span>
          <select value={headerPlacement} onChange={event => setHeaderPlacement(event.target.value as HeaderPlacement)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
            <option value="off">Do not include</option>
            <option value="first">First page only</option>
            <option value="all">Every page</option>
          </select>
        </label>
        <PlacementField label="Signature" value={signature} onChange={setSignature} />
        <PlacementField label="Company seal" value={stamp} onChange={setStamp} />
        <AddTodayDateField checked={showDate} onChange={setShowDate} />
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
            onClick={() => { setPositions({}); setScales({}); }}>Reset positions and sizes</button>
          <button type="button" className="btn-primary min-h-11 px-3" disabled={!canSave}
            onClick={() => void save()}>{saving ? 'Saving…' : 'Save as PDF'}</button>
        </div>
      )}
      {displayed && layout && (
        <>
          <p id="original-pdf-mark-instructions" className="text-sm text-slate-600">Drag a mark to move it. Pinch the signature or seal with two fingers to resize it, or use its size slider.</p>
          {activeMarks.some(mark => mark.kind !== 'date') && (
            <div className="flex flex-wrap gap-4">
              {activeMarks.filter(mark => mark.kind !== 'date').map(mark => {
                const scale = scales[index]?.[mark.kind] ?? 1;
                return <label key={mark.kind} className="grid min-w-36 gap-1 text-sm font-semibold">
                  {mark.kind === 'signature' ? 'Signature size' : 'Seal size'} · {Math.round(scale * 100)}%
                  <input type="range" min="40" max="250" step="1" value={Math.round(scale * 100)} disabled={saving}
                    onChange={event => changeScale(mark.kind, Number(event.target.value) / 100)} />
                </label>;
              })}
            </div>
          )}
          <div className="relative mx-auto max-w-[900px] select-none bg-white ring-1 ring-slate-300"
            onDragStart={event => event.preventDefault()}
            style={{ aspectRatio: `${layout.width} / ${layout.height}` }}>
            {activeHeader && <img src={assets.letterhead} alt="Company letterhead" draggable={false} className="block w-full"
              style={{ height: `${layout.headerHeight / layout.height * 100}%` }} />}
            <img src={displayed.src} alt={`Original PDF, page ${index + 1}`} draggable={false} className="block w-full"
              style={{ height: `${displayed.size.height / layout.height * 100}%` }} />
            {activeMarks.map(mark => {
              const scale = scales[index]?.[mark.kind] ?? 1;
              const box = markBox(layout, mark.kind, scale, positions[index]?.[mark.kind]);
              return <Fragment key={`${index}:${mark.kind}`}><DraggableMark kind={mark.kind} pageNumber={index + 1}
                src={mark.src} pageSize={layout} size={box} disabled={saving} instructionsId="original-pdf-mark-instructions"
                position={box}
                resize={mark.kind === 'date' ? undefined : { scale, onChange: value => changeScale(mark.kind, value) }}
                onMove={position => setPositions(previous => ({
                  ...previous, [index]: { ...previous[index], [mark.kind]: markBox(layout, mark.kind, scale, position) }
                }))} /></Fragment>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
