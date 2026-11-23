import { useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { Download, Eye } from 'lucide-react';
import { CR_UPDATED_EVENT, LOCAL_STORAGE_CR_KEY, crService } from '../../services/crService';
import { getAdminRegisteredCrs } from '../lib/crEntities';
import { BackToModulesButton } from '../shared/BackToModulesButton';
import {
  clampMarkPosition, createLetterHeadPdf, defaultParagraphStyle, getMarkPosition, letterPageSize,
  markShowsOnPage, markSizes, maximumFontSize, minimumFontSize, renderLetterHeadPages, splitLetterParagraphs
} from './letterHeadPdf';
import type { HeaderStyle, MarkKind, MarkPlacement, MarkPosition, PageMarkPositions, ParagraphStyle, ParagraphStyles } from './letterHeadPdf';

const fieldClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';
const maxLength = 100_000;
const arrowMovement: Record<string, MarkPosition> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }
};

function DraggableMark({ kind, pageNumber, src, position, disabled, onMove }: {
  kind: MarkKind;
  pageNumber: number;
  src: string;
  position: MarkPosition;
  disabled: boolean;
  onMove: (position: MarkPosition) => void;
}) {
  const drag = useRef<{
    id: number;
    clientX: number;
    clientY: number;
    scaleX: number;
    scaleY: number;
    position: MarkPosition;
  } | null>(null);
  const { width, height } = letterPageSize;
  const size = markSizes[kind];
  const label = kind === 'signature' ? 'signature' : 'company seal';

  return (
    <button type="button" aria-label={`Move ${label} on page ${pageNumber}`} aria-describedby="letter-mark-instructions"
      disabled={disabled}
      className="absolute touch-none select-none cursor-grab rounded-sm hover:outline hover:outline-2 hover:outline-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 active:cursor-grabbing"
      style={{
        left: `${position.x / width * 100}%`,
        top: `${position.y / height * 100}%`,
        width: `${size.width / width * 100}%`,
        height: `${size.height / height * 100}%`
      }}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current) return;
        const page = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!page?.width || !page.height) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          id: event.pointerId, clientX: event.clientX, clientY: event.clientY,
          scaleX: width / page.width, scaleY: height / page.height, position
        };
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        onMove({
          x: start.position.x + (event.clientX - start.clientX) * start.scaleX,
          y: start.position.y + (event.clientY - start.clientY) * start.scaleY
        });
      }}
      onLostPointerCapture={event => {
        if (drag.current?.id === event.pointerId) drag.current = null;
      }}
      onKeyDown={event => {
        const direction = arrowMovement[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 2;
        onMove({ x: position.x + direction.x * step, y: position.y + direction.y * step });
      }}>
      <img src={src} alt="" draggable={false} className="pointer-events-none block h-full w-full" />
    </button>
  );
}

function PlacementField({ label, value, onChange }: {
  label: string;
  value: MarkPlacement;
  onChange: (value: MarkPlacement) => void;
}) {
  return <label className="block space-y-2 text-sm font-semibold">
    <span>{label}</span>
    <select className={fieldClass} value={value} onChange={event => onChange(event.target.value as MarkPlacement)}>
      <option value="off">Do not include</option>
      <option value="last">Last page only</option>
      <option value="all">Every page</option>
    </select>
  </label>;
}

function PreviewTextEditor({ letter, styles, busy, onApply }: {
  letter: string;
  styles: ParagraphStyles;
  busy: boolean;
  onApply: (index: number, text: string, style: ParagraphStyle) => void;
}) {
  const paragraphs = splitLetterParagraphs(letter);
  const [index, setIndex] = useState(() => Math.max(0, paragraphs.findIndex(text => text.trim())));
  const original = styles[index] ?? defaultParagraphStyle;
  const [text, setText] = useState(paragraphs[index] ?? '');
  const [style, setStyle] = useState(original);
  const hasChanges = text !== paragraphs[index] || style.bold !== original.bold ||
    style.alignment !== original.alignment || style.size !== original.size;

  function selectParagraph(next: number) {
    setIndex(next);
    setText(paragraphs[next]);
    setStyle(styles[next] ?? defaultParagraphStyle);
  }

  return (
    <details className="rounded-lg border border-slate-200 bg-white px-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Edit letter text and formatting</summary>
      <fieldset disabled={busy} className="space-y-3 pb-4">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Paragraph to edit</span>
          <select value={index} onChange={event => selectParagraph(Number(event.target.value))} className={fieldClass}>
            {paragraphs.map((paragraph, i) => (
              <option key={i} value={i}>{i + 1}. {paragraph.trim().slice(0, 75) || 'Blank line'}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Paragraph text</span>
          <textarea dir="auto" rows={3} value={text} maxLength={maxLength - letter.length + paragraphs[index].length}
            onChange={event => setText(event.target.value.replace(/\r\n?|\n/g, ' '))} className={fieldClass} />
        </label>
        <div className="grid items-end gap-3 sm:grid-cols-3">
          <label className="block space-y-2 text-sm font-semibold">
            <span>Alignment</span>
            <select value={style.alignment} className={fieldClass}
              onChange={event => setStyle({ ...style, alignment: event.target.value as ParagraphStyle['alignment'] })}>
              <option value="auto">Automatic</option>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            <span>Font size (pt)</span>
            <select value={style.size} className={fieldClass}
              onChange={event => setStyle({ ...style, size: Number(event.target.value) })}>
              {Array.from({ length: maximumFontSize - minimumFontSize + 1 }, (_, i) => i + minimumFontSize)
                .map(size => <option value={size} key={size}>{size}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={style.bold} onChange={event => setStyle({ ...style, bold: event.target.checked })} />
            Bold
          </label>
        </div>
        <button type="button" disabled={!hasChanges || busy}
          className="btn-secondary min-h-11 px-4 disabled:opacity-50" onClick={() => onApply(index, text, style)}>
          Apply to preview
        </button>
      </fieldset>
    </details>
  );
}

export function LetterHeadGenerator({ onBack }: { onBack: () => void }) {
  const [companies, setCompanies] = useState(getAdminRegisteredCrs);
  const [companyId, setCompanyId] = useState('');
  const [header, setHeader] = useState<HeaderStyle>('company');
  const [letter, setLetter] = useState('');
  const [paragraphStyles, setParagraphStyles] = useState<ParagraphStyles>({});
  const [signature, setSignature] = useState<MarkPlacement>('off');
  const [stamp, setStamp] = useState<MarkPlacement>('off');
  const [markPositions, setMarkPositions] = useState<PageMarkPositions>({});
  const [fitToOnePage, setFitToOnePage] = useState(false);
  const [busy, setBusy] = useState<'import' | 'preview' | 'download' | null>(null);
  const [error, setError] = useState('');
  const [importedFile, setImportedFile] = useState('');
  const [preview, setPreview] = useState<{
    options: Parameters<typeof renderLetterHeadPages>[0];
    result: Awaited<ReturnType<typeof renderLetterHeadPages>>;
  } | null>(null);
  const [downloadNotice, setDownloadNotice] = useState('');
  const company = companies.find(item => item.id === companyId) ?? companies[0];
  const currentPreview = preview && preview.options.company === company && preview.options.header === header &&
    preview.options.text === letter && preview.options.paragraphStyles === paragraphStyles && preview.options.signature === signature &&
    preview.options.stamp === stamp && preview.options.fitToOnePage === fitToOnePage ? preview.result : null;

  useEffect(() => {
    setDownloadNotice('');
  }, [company, header, letter, signature, stamp, fitToOnePage]);

  useEffect(() => {
    let mounted = true;
    void crService.list().then(items => {
      if (mounted && items.length) setCompanies(items);
    }).catch(console.error);
    const updateFromCache = () => setCompanies(getAdminRegisteredCrs());
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_CR_KEY) updateFromCache();
    };
    window.addEventListener(CR_UPDATED_EVENT, updateFromCache);
    window.addEventListener('storage', onStorage);
    return () => {
      mounted = false;
      window.removeEventListener(CR_UPDATED_EVENT, updateFromCache);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  async function importFile(file: File) {
    setBusy('import');
    setError('');
    try {
      const { importLetterText } = await import('./letterHeadImport');
      const content = await importLetterText(file);
      if (content.length > maxLength) throw new Error('The imported letter exceeds 100,000 characters.');
      setLetter(content);
      setParagraphStyles({});
      setImportedFile(file.name);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The file could not be imported.');
    } finally {
      setBusy(null);
    }
  }

  async function generate(action: 'preview' | 'download', edit?: { index: number; text: string; style: ParagraphStyle }) {
    if (!company || !letter.trim()) return;
    const paragraphs = splitLetterParagraphs(letter);
    if (edit) paragraphs[edit.index] = edit.text;
    const text = edit ? paragraphs.join('\n') : letter;
    if (!text.trim()) {
      setError('Enter some letter text before updating the preview.');
      return;
    }
    setBusy(action);
    setError('');
    setDownloadNotice('');
    try {
      const styles = edit ? { ...paragraphStyles, [edit.index]: edit.style } : paragraphStyles;
      const options = { company, header, text, signature, stamp, fitToOnePage, paragraphStyles: styles };
      const result = (!edit && currentPreview) || await renderLetterHeadPages(options);
      if (action === 'preview') {
        if (edit) {
          setLetter(text);
          setParagraphStyles(styles);
        }
        setPreview({ options, result });
        return;
      }
      const blob = await createLetterHeadPdf(company.cr_name, result, markPositions);
      const safeName = company.cr_name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 90);
      saveAs(blob, `Letter Head - ${safeName || 'Company'}.pdf`);
      if (fitToOnePage && result.pageImages.length > 1) {
        setDownloadNotice(`The letter needed ${result.pageImages.length} pages at the minimum text size.`);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not prepare the letter.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-5 px-3 py-5 text-slate-900 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Letter Head Generation</h1>
        <BackToModulesButton onClick={onBack} />
      </header>
      <fieldset disabled={busy !== null} className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold">
            <span>Company</span>
            <select className={fieldClass} value={company?.id ?? ''} onChange={event => setCompanyId(event.target.value)}>
              {companies.map(item => <option value={item.id} key={item.id}>{item.cr_name} · CR {item.cr_number}</option>)}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            <span>Letterhead</span>
            <select className={fieldClass} value={header} onChange={event => setHeader(event.target.value as HeaderStyle)}>
              <option value="company">Company letterhead</option>
              <option value="none">None</option>
            </select>
          </label>
          <PlacementField label="Signature" value={signature} onChange={setSignature} />
          <PlacementField label="Company seal" value={stamp} onChange={setStamp} />
        </div>
        <label className="flex min-h-11 items-start gap-3 rounded-lg bg-slate-50 p-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-slate-900"
            checked={fitToOnePage} onChange={event => setFitToOnePage(event.target.checked)} />
          <span>
            <span className="block text-sm font-semibold">Fit to one page</span>
            <span className="block text-sm text-slate-600">Shrink the letter text as needed, down to 9 pt. Longer letters can still use multiple pages.</span>
          </span>
        </label>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <label htmlFor="letter-head-file" className="block text-sm font-semibold">Import Word or PDF</label>
          <input id="letter-head-file" type="file" accept=".docx,.pdf" aria-describedby="letter-head-import-help"
            className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:font-semibold"
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void importFile(file);
            }} />
          <p id="letter-head-import-help" className="text-sm text-slate-600">Use a .docx or a PDF with selectable text. Import replaces the text below.</p>
          <p role="status" className="break-words text-sm text-slate-600">
            {busy === 'import' ? 'Importing text…' : importedFile ? `Imported ${importedFile}` : ''}
          </p>
        </div>

        <label className="block space-y-2 text-sm font-semibold">
          <span>Letter text</span>
          <textarea className={`${fieldClass} min-h-64 resize-y text-base font-normal leading-relaxed`}
            dir="auto" rows={12} maxLength={maxLength} value={letter}
            onChange={event => {
              const next = event.target.value;
              const before = splitLetterParagraphs(letter);
              const after = splitLetterParagraphs(next);
              if (before.length !== after.length) {
                let start = 0;
                let oldEnd = before.length;
                let newEnd = after.length;
                while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
                while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
                  oldEnd--;
                  newEnd--;
                }
                setParagraphStyles(previous => {
                  const updated: ParagraphStyles = {};
                  for (const [key, style] of Object.entries(previous)) {
                    const index = Number(key);
                    if (index < oldEnd && index < newEnd) updated[index] = style;
                    if (index >= oldEnd) updated[index + newEnd - oldEnd] = style;
                  }
                  return updated;
                });
              }
              setLetter(next);
            }} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {downloadNotice && <p role="status" className="text-sm text-slate-700">{downloadNotice}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={!company || !letter.trim() || busy !== null}
            onClick={() => void generate('preview')}
            className="btn-secondary inline-flex min-h-11 items-center gap-2 px-4 disabled:opacity-50">
            <Eye className="h-4 w-4" aria-hidden="true" />
            {busy === 'preview' ? 'Preparing preview…' : 'Preview PDF'}
          </button>
          <button type="button" disabled={!company || !letter.trim() || busy !== null}
            onClick={() => void generate('download')}
            className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy === 'download' ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      </fieldset>
      {currentPreview && (
        <section aria-labelledby="letter-head-preview" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="letter-head-preview" className="text-lg font-bold">PDF preview</h2>
              <p role="status" className="text-sm text-slate-600">
                {currentPreview.pageImages.length} {currentPreview.pageImages.length === 1 ? 'page' : 'pages'} · A4 · {currentPreview.fontSizeLabel} pt
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy !== null} onClick={() => void generate('download')}
                className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 disabled:opacity-50">
                <Download className="h-4 w-4" aria-hidden="true" />
                {busy === 'download' ? 'Generating PDF…' : 'Download PDF'}
              </button>
              <button type="button" className="btn-secondary min-h-11 px-4" onClick={() => setPreview(null)}>
                Close preview
              </button>
            </div>
          </div>
          <PreviewTextEditor letter={letter} styles={paragraphStyles} busy={busy !== null}
            onApply={(index, text, style) => void generate('preview', { index, text, style })} />
          {fitToOnePage && currentPreview.pageImages.length > 1 && (
            <p className="text-sm text-slate-700">This letter needs more than one page at the minimum text size.</p>
          )}
          {currentPreview.marks.some(mark => mark.src) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="letter-mark-instructions" className="text-sm text-slate-700">
                Drag the signature or seal, or focus it and use the arrow keys.
                {currentPreview.pageImages.length > 1 && ' Each page has its own positions.'}
              </p>
              <button type="button" disabled={busy !== null} className="btn-secondary min-h-11 px-4"
                onClick={() => setMarkPositions({})}>
                Reset all positions
              </button>
            </div>
          )}
          <div className="mx-auto max-w-[800px] space-y-4">
            {currentPreview.pageImages.map((src, index) => (
              <div key={index} className="relative bg-white shadow-sm ring-1 ring-slate-300"
                style={{ aspectRatio: `${letterPageSize.width} / ${letterPageSize.height}` }}>
                <img src={src} alt={`Letter preview, page ${index + 1}`} loading="lazy"
                  width={1786} height={2526} className="block h-full w-full" />
                {currentPreview.marks.map(mark => mark.src &&
                  markShowsOnPage(mark.placement, index, currentPreview.pageImages.length) && (
                    <DraggableMark key={mark.kind} kind={mark.kind} pageNumber={index + 1}
                      src={mark.src} disabled={busy !== null}
                      position={getMarkPosition(markPositions, index, mark.kind)}
                      onMove={position => setMarkPositions(previous => ({
                        ...previous,
                        [index]: { ...previous[index], [mark.kind]: clampMarkPosition(mark.kind, position) }
                      }))} />
                  ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
