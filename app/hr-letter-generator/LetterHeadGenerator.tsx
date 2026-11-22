import { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import { Download, Eye } from 'lucide-react';
import { CR_UPDATED_EVENT, LOCAL_STORAGE_CR_KEY, crService } from '../../services/crService';
import { getAdminRegisteredCrs } from '../lib/crEntities';
import { BackToModulesButton } from '../shared/BackToModulesButton';
import type { MarkPlacement, renderLetterHeadPages } from './letterHeadPdf';

const fieldClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';
const maxLength = 100_000;

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

export function LetterHeadGenerator({ onBack }: { onBack: () => void }) {
  const [companies, setCompanies] = useState(getAdminRegisteredCrs);
  const [companyId, setCompanyId] = useState('');
  const [letter, setLetter] = useState('');
  const [signature, setSignature] = useState<MarkPlacement>('off');
  const [stamp, setStamp] = useState<MarkPlacement>('off');
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
  const currentPreview = preview && preview.options.company === company &&
    preview.options.text === letter && preview.options.signature === signature &&
    preview.options.stamp === stamp && preview.options.fitToOnePage === fitToOnePage ? preview.result : null;

  useEffect(() => {
    setPreview(null);
    setDownloadNotice('');
  }, [company, letter, signature, stamp, fitToOnePage]);

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
      setImportedFile(file.name);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The file could not be imported.');
    } finally {
      setBusy(null);
    }
  }

  async function generate(action: 'preview' | 'download') {
    if (!company || !letter.trim()) return;
    setBusy(action);
    setError('');
    setDownloadNotice('');
    try {
      const { renderLetterHeadPages, createLetterHeadPdf } = await import('./letterHeadPdf');
      const options = { company, text: letter, signature, stamp, fitToOnePage };
      const result = currentPreview ?? await renderLetterHeadPages(options);
      if (action === 'preview') {
        setPreview({ options, result });
        return;
      }
      const blob = await createLetterHeadPdf(company.cr_name, result.pageImages);
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
          <label className="block space-y-2 text-sm font-semibold sm:col-span-2">
            <span>Company</span>
            <select className={fieldClass} value={company?.id ?? ''} onChange={event => setCompanyId(event.target.value)}>
              {companies.map(item => <option value={item.id} key={item.id}>{item.cr_name} · CR {item.cr_number}</option>)}
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
            onChange={event => setLetter(event.target.value)} />
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
                {currentPreview.pageImages.length} {currentPreview.pageImages.length === 1 ? 'page' : 'pages'} · A4 · {currentPreview.fontSize} pt
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
          {fitToOnePage && currentPreview.pageImages.length > 1 && (
            <p className="text-sm text-slate-700">This letter needs more than one page at the minimum text size.</p>
          )}
          <div className="mx-auto max-w-[800px] space-y-4">
            {currentPreview.pageImages.map((src, index) => (
              <img key={index} src={src} alt={`Letter preview, page ${index + 1}`} loading="lazy"
                width={1786} height={2526} className="h-auto w-full border border-slate-300 bg-white shadow-sm" />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
